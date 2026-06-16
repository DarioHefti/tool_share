package tools

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dariohefti/toolshare/internal/ctxutil"
	"github.com/dariohefti/toolshare/internal/httputil"
	"github.com/dariohefti/toolshare/internal/models"
)

var validCategories = map[string]bool{
	"Drilling": true, "Cutting": true, "Measuring": true, "Sanding": true,
	"Fastening": true, "Clamping": true, "Gardening": true, "Painting": true,
	"Plumbing": true, "Electrical": true, "Other": true,
}

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

type createToolRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

type updateToolRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
}

type shareRequest struct {
	GroupID string `json:"groupId"`
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	tools, err := h.listByOwner(r, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not list tools")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, tools)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	toolID := chi.URLParam(r, "id")

	if tool, err := h.getOwnedTool(r, toolID, userID); err == nil {
		httputil.WriteJSON(w, http.StatusOK, tool)
		return
	}

	var visible bool
	err := h.pool.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM tools t
			INNER JOIN tool_group_shares tgs ON tgs.tool_id = t.id
			INNER JOIN group_members gm ON gm.group_id = tgs.group_id
			WHERE t.id = $1 AND gm.user_id = $2
		)`, toolID, userID).Scan(&visible)
	if err != nil || !visible {
		httputil.WriteError(w, http.StatusNotFound, "tool not found")
		return
	}

	var tool models.Tool
	err = h.pool.QueryRow(r.Context(), `
		SELECT id, owner_id, name, description, category
		FROM tools WHERE id = $1`, toolID,
	).Scan(&tool.ID, &tool.OwnerID, &tool.Name, &tool.Description, &tool.Category)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "tool not found")
		return
	}
	tool.SharedToGroups, _ = h.sharedGroups(r, tool.ID)
	httputil.WriteJSON(w, http.StatusOK, tool)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	var req createToolRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Description == "" || !validCategories[req.Category] {
		httputil.WriteError(w, http.StatusBadRequest, "name, description and valid category required")
		return
	}

	var tool models.Tool
	err := h.pool.QueryRow(r.Context(), `
		INSERT INTO tools (owner_id, name, description, category)
		VALUES ($1, $2, $3, $4)
		RETURNING id, owner_id, name, description, category`,
		userID, req.Name, req.Description, req.Category,
	).Scan(&tool.ID, &tool.OwnerID, &tool.Name, &tool.Description, &tool.Category)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not create tool")
		return
	}
	tool.SharedToGroups = []string{}
	httputil.WriteJSON(w, http.StatusCreated, tool)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	toolID := chi.URLParam(r, "id")

	var req updateToolRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tool, err := h.getOwnedTool(r, toolID, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "tool not found")
		return
	}

	if req.Name != nil {
		tool.Name = *req.Name
	}
	if req.Description != nil {
		tool.Description = *req.Description
	}
	if req.Category != nil {
		if !validCategories[*req.Category] {
			httputil.WriteError(w, http.StatusBadRequest, "invalid category")
			return
		}
		tool.Category = *req.Category
	}

	_, err = h.pool.Exec(r.Context(), `
		UPDATE tools SET name = $1, description = $2, category = $3
		WHERE id = $4 AND owner_id = $5`,
		tool.Name, tool.Description, tool.Category, toolID, userID,
	)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not update tool")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, tool)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	toolID := chi.URLParam(r, "id")

	tag, err := h.pool.Exec(r.Context(), `
		DELETE FROM tools WHERE id = $1 AND owner_id = $2`, toolID, userID)
	if err != nil || tag.RowsAffected() == 0 {
		httputil.WriteError(w, http.StatusNotFound, "tool not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Share(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	toolID := chi.URLParam(r, "id")

	var req shareRequest
	if err := httputil.DecodeJSON(r, &req); err != nil || req.GroupID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "groupId required")
		return
	}

	if _, err := h.getOwnedTool(r, toolID, userID); err != nil {
		httputil.WriteError(w, http.StatusNotFound, "tool not found")
		return
	}

	var isMember bool
	err := h.pool.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2
		)`, req.GroupID, userID).Scan(&isMember)
	if err != nil || !isMember {
		httputil.WriteError(w, http.StatusForbidden, "not a member of this group")
		return
	}

	_, err = h.pool.Exec(r.Context(), `
		INSERT INTO tool_group_shares (tool_id, group_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, toolID, req.GroupID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not share tool")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Unshare(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	toolID := chi.URLParam(r, "id")
	groupID := chi.URLParam(r, "groupId")

	if _, err := h.getOwnedTool(r, toolID, userID); err != nil {
		httputil.WriteError(w, http.StatusNotFound, "tool not found")
		return
	}

	_, err := h.pool.Exec(r.Context(), `
		DELETE FROM tool_group_shares WHERE tool_id = $1 AND group_id = $2`,
		toolID, groupID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not unshare tool")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getOwnedTool(r *http.Request, toolID, userID string) (models.Tool, error) {
	var tool models.Tool
	err := h.pool.QueryRow(r.Context(), `
		SELECT id, owner_id, name, description, category
		FROM tools WHERE id = $1 AND owner_id = $2`,
		toolID, userID,
	).Scan(&tool.ID, &tool.OwnerID, &tool.Name, &tool.Description, &tool.Category)
	if err != nil {
		return tool, err
	}
	tool.SharedToGroups, _ = h.sharedGroups(r, tool.ID)
	return tool, nil
}

func (h *Handler) listByOwner(r *http.Request, ownerID string) ([]models.Tool, error) {
	rows, err := h.pool.Query(r.Context(), `
		SELECT id, owner_id, name, description, category
		FROM tools WHERE owner_id = $1 ORDER BY created_at DESC`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tools []models.Tool
	for rows.Next() {
		var t models.Tool
		if err := rows.Scan(&t.ID, &t.OwnerID, &t.Name, &t.Description, &t.Category); err != nil {
			return nil, err
		}
		t.SharedToGroups, _ = h.sharedGroups(r, t.ID)
		tools = append(tools, t)
	}
	if tools == nil {
		tools = []models.Tool{}
	}
	return tools, rows.Err()
}

func (h *Handler) sharedGroups(r *http.Request, toolID string) ([]string, error) {
	rows, err := h.pool.Query(r.Context(), `
		SELECT group_id FROM tool_group_shares WHERE tool_id = $1`, toolID)
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

func (h *Handler) ListSharedInGroup(r *http.Request, groupID string) ([]models.Tool, error) {
	rows, err := h.pool.Query(r.Context(), `
		SELECT t.id, t.owner_id, t.name, t.description, t.category
		FROM tools t
		INNER JOIN tool_group_shares tgs ON tgs.tool_id = t.id
		WHERE tgs.group_id = $1
		ORDER BY t.name`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tools []models.Tool
	for rows.Next() {
		var t models.Tool
		if err := rows.Scan(&t.ID, &t.OwnerID, &t.Name, &t.Description, &t.Category); err != nil {
			return nil, err
		}
		t.SharedToGroups = []string{groupID}
		tools = append(tools, t)
	}
	if tools == nil {
		tools = []models.Tool{}
	}
	return tools, rows.Err()
}
