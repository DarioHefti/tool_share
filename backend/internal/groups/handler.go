package groups

import (
	"crypto/rand"
	"math/big"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dariohefti/toolshare/internal/ctxutil"
	"github.com/dariohefti/toolshare/internal/httputil"
	"github.com/dariohefti/toolshare/internal/models"
	"github.com/dariohefti/toolshare/internal/tools"
)

type Handler struct {
	pool        *pgxpool.Pool
	toolHandler *tools.Handler
}

func NewHandler(pool *pgxpool.Pool, toolHandler *tools.Handler) *Handler {
	return &Handler{pool: pool, toolHandler: toolHandler}
}

type createGroupRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type joinGroupRequest struct {
	InviteCode string `json:"inviteCode"`
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	groups, err := h.listForUser(r, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not list groups")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, groups)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	var req createGroupRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Description == "" {
		httputil.WriteError(w, http.StatusBadRequest, "name and description required")
		return
	}

	code, err := generateInviteCode()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not generate invite code")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "database error")
		return
	}
	defer tx.Rollback(r.Context())

	var group models.Group
	err = tx.QueryRow(r.Context(), `
		INSERT INTO groups (name, description, created_by, invite_code)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, description, created_by, invite_code`,
		req.Name, req.Description, userID, code,
	).Scan(&group.ID, &group.Name, &group.Description, &group.CreatedBy, &group.InviteCode)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not create group")
		return
	}

	_, err = tx.Exec(r.Context(), `
		INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)`,
		group.ID, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not add creator to group")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not commit")
		return
	}

	group.MemberIDs = []string{userID}
	httputil.WriteJSON(w, http.StatusCreated, group)
}

func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	var req joinGroupRequest
	if err := httputil.DecodeJSON(r, &req); err != nil || req.InviteCode == "" {
		httputil.WriteError(w, http.StatusBadRequest, "inviteCode required")
		return
	}

	var groupID string
	err := h.pool.QueryRow(r.Context(), `
		SELECT id FROM groups WHERE UPPER(invite_code) = UPPER($1)`, req.InviteCode,
	).Scan(&groupID)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "group not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "database error")
		return
	}

	_, err = h.pool.Exec(r.Context(), `
		INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, groupID, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not join group")
		return
	}

	group, err := h.getGroup(r, groupID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not load group")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, group)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	groupID := chi.URLParam(r, "id")

	if !h.isMember(r, groupID, userID) {
		httputil.WriteError(w, http.StatusForbidden, "not a member of this group")
		return
	}

	group, err := h.getGroup(r, groupID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "group not found")
		return
	}

	sharedTools, err := h.toolHandler.ListSharedInGroup(r, groupID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not load shared tools")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, models.GroupDetail{
		Group:       group,
		SharedTools: sharedTools,
	})
}

func (h *Handler) LeaveOrDelete(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	groupID := chi.URLParam(r, "id")

	var createdBy string
	err := h.pool.QueryRow(r.Context(), `
		SELECT created_by FROM groups WHERE id = $1`, groupID,
	).Scan(&createdBy)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "group not found")
		return
	}

	if createdBy == userID {
		_, err = h.pool.Exec(r.Context(), `DELETE FROM groups WHERE id = $1`, groupID)
	} else {
		_, err = h.pool.Exec(r.Context(), `
			DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
			groupID, userID)
	}
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not leave or delete group")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getGroup(r *http.Request, groupID string) (models.Group, error) {
	var g models.Group
	err := h.pool.QueryRow(r.Context(), `
		SELECT id, name, description, created_by, invite_code
		FROM groups WHERE id = $1`, groupID,
	).Scan(&g.ID, &g.Name, &g.Description, &g.CreatedBy, &g.InviteCode)
	if err != nil {
		return g, err
	}
	g.MemberIDs, err = h.memberIDs(r, groupID)
	return g, err
}

func (h *Handler) listForUser(r *http.Request, userID string) ([]models.Group, error) {
	rows, err := h.pool.Query(r.Context(), `
		SELECT g.id, g.name, g.description, g.created_by, g.invite_code
		FROM groups g
		INNER JOIN group_members gm ON gm.group_id = g.id
		WHERE gm.user_id = $1
		ORDER BY g.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.Group
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.CreatedBy, &g.InviteCode); err != nil {
			return nil, err
		}
		g.MemberIDs, _ = h.memberIDs(r, g.ID)
		groups = append(groups, g)
	}
	if groups == nil {
		groups = []models.Group{}
	}
	return groups, rows.Err()
}

func (h *Handler) memberIDs(r *http.Request, groupID string) ([]string, error) {
	rows, err := h.pool.Query(r.Context(), `
		SELECT user_id FROM group_members WHERE group_id = $1`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if ids == nil {
		ids = []string{}
	}
	return ids, rows.Err()
}

func (h *Handler) isMember(r *http.Request, groupID, userID string) bool {
	var ok bool
	_ = h.pool.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)`,
		groupID, userID).Scan(&ok)
	return ok
}

func generateInviteCode() (string, error) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 6)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[n.Int64()]
	}
	return string(code), nil
}
