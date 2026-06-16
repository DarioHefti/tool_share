package requests

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dariohefti/toolshare/internal/ctxutil"
	"github.com/dariohefti/toolshare/internal/httputil"
	"github.com/dariohefti/toolshare/internal/models"
)

var validStatuses = map[string]bool{
	"pending": true, "approved": true, "declined": true, "returned": true,
}

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

type createRequest struct {
	ToolID  string  `json:"toolId"`
	GroupID string  `json:"groupId"`
	Message *string `json:"message"`
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (h *Handler) ListIncoming(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	list, err := h.listByOwner(r, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not list requests")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, list)
}

func (h *Handler) ListOutgoing(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	list, err := h.listByRequester(r, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not list requests")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, list)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	var req createRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ToolID == "" || req.GroupID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "toolId and groupId required")
		return
	}

	var ownerID string
	err := h.pool.QueryRow(r.Context(), `
		SELECT owner_id FROM tools WHERE id = $1`, req.ToolID,
	).Scan(&ownerID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "tool not found")
		return
	}
	if ownerID == userID {
		httputil.WriteError(w, http.StatusBadRequest, "cannot borrow your own tool")
		return
	}

	var shared bool
	err = h.pool.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM tool_group_shares WHERE tool_id = $1 AND group_id = $2
		)`, req.ToolID, req.GroupID).Scan(&shared)
	if err != nil || !shared {
		httputil.WriteError(w, http.StatusBadRequest, "tool is not shared to this group")
		return
	}

	var isMember bool
	err = h.pool.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2
		)`, req.GroupID, userID).Scan(&isMember)
	if err != nil || !isMember {
		httputil.WriteError(w, http.StatusForbidden, "not a member of this group")
		return
	}

	var active bool
	err = h.pool.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM borrow_requests
			WHERE tool_id = $1 AND requester_id = $2 AND status IN ('pending', 'approved')
		)`, req.ToolID, userID).Scan(&active)
	if err == nil && active {
		httputil.WriteError(w, http.StatusConflict, "active request already exists")
		return
	}

	var br models.BorrowRequest
	err = h.pool.QueryRow(r.Context(), `
		INSERT INTO borrow_requests (tool_id, requester_id, owner_id, group_id, message)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, tool_id, requester_id, owner_id, group_id, status, message, created_at`,
		req.ToolID, userID, ownerID, req.GroupID, req.Message,
	).Scan(&br.ID, &br.ToolID, &br.RequesterID, &br.OwnerID, &br.GroupID,
		&br.Status, &br.Message, &br.CreatedAt)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not create request")
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, br)
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	requestID := chi.URLParam(r, "id")

	var req updateStatusRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !validStatuses[req.Status] {
		httputil.WriteError(w, http.StatusBadRequest, "invalid status")
		return
	}

	var ownerID, currentStatus string
	err := h.pool.QueryRow(r.Context(), `
		SELECT owner_id, status FROM borrow_requests WHERE id = $1`, requestID,
	).Scan(&ownerID, &currentStatus)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "request not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "database error")
		return
	}
	if ownerID != userID {
		httputil.WriteError(w, http.StatusForbidden, "only the tool owner can update status")
		return
	}

	// Simple state machine
	allowed := false
	switch currentStatus {
	case "pending":
		allowed = req.Status == "approved" || req.Status == "declined"
	case "approved":
		allowed = req.Status == "returned"
	}
	if !allowed {
		httputil.WriteError(w, http.StatusBadRequest, "invalid status transition")
		return
	}

	var br models.BorrowRequest
	err = h.pool.QueryRow(r.Context(), `
		UPDATE borrow_requests SET status = $1 WHERE id = $2
		RETURNING id, tool_id, requester_id, owner_id, group_id, status, message, created_at`,
		req.Status, requestID,
	).Scan(&br.ID, &br.ToolID, &br.RequesterID, &br.OwnerID, &br.GroupID,
		&br.Status, &br.Message, &br.CreatedAt)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not update request")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, br)
}

func (h *Handler) listByOwner(r *http.Request, ownerID string) ([]models.BorrowRequest, error) {
	return h.queryList(r, `
		SELECT id, tool_id, requester_id, owner_id, group_id, status, message, created_at
		FROM borrow_requests WHERE owner_id = $1 ORDER BY created_at DESC`, ownerID)
}

func (h *Handler) listByRequester(r *http.Request, requesterID string) ([]models.BorrowRequest, error) {
	return h.queryList(r, `
		SELECT id, tool_id, requester_id, owner_id, group_id, status, message, created_at
		FROM borrow_requests WHERE requester_id = $1 ORDER BY created_at DESC`, requesterID)
}

func (h *Handler) queryList(r *http.Request, query, id string) ([]models.BorrowRequest, error) {
	rows, err := h.pool.Query(r.Context(), query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.BorrowRequest
	for rows.Next() {
		var br models.BorrowRequest
		if err := rows.Scan(&br.ID, &br.ToolID, &br.RequesterID, &br.OwnerID, &br.GroupID,
			&br.Status, &br.Message, &br.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, br)
	}
	if list == nil {
		list = []models.BorrowRequest{}
	}
	return list, rows.Err()
}
