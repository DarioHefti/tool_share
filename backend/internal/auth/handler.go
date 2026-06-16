package auth

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/dariohefti/toolshare/internal/ctxutil"
	"github.com/dariohefti/toolshare/internal/httputil"
	"github.com/dariohefti/toolshare/internal/models"
)

const cookieName = "token"

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
)

type Handler struct {
	pool      *pgxpool.Pool
	jwtSecret []byte
}

func NewHandler(pool *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{pool: pool, jwtSecret: []byte(jwtSecret)}
}

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Email == "" || len(req.Password) < 6 {
		httputil.WriteError(w, http.StatusBadRequest, "name, email and password (min 6 chars) required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not hash password")
		return
	}

	var user models.User
	err = h.pool.QueryRow(r.Context(), `
		INSERT INTO users (email, name, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, email, name`,
		req.Email, req.Name, string(hash),
	).Scan(&user.ID, &user.Email, &user.Name)
	if err != nil {
		if isUniqueViolation(err) {
			httputil.WriteError(w, http.StatusConflict, ErrEmailTaken.Error())
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	if err := h.setAuthCookie(w, user.ID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not create session")
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, user)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var userID, email, name, passwordHash string
	err := h.pool.QueryRow(r.Context(), `
		SELECT id, email, name, password_hash FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &email, &name, &passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.WriteError(w, http.StatusUnauthorized, ErrInvalidCredentials.Error())
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "database error")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, ErrInvalidCredentials.Error())
		return
	}

	if err := h.setAuthCookie(w, userID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "could not create session")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, models.User{ID: userID, Email: email, Name: name})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	var user models.User
	err := h.pool.QueryRow(r.Context(), `
		SELECT id, email, name FROM users WHERE id = $1`, userID,
	).Scan(&user.ID, &user.Email, &user.Name)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, user)
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotPasswordRequest
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	// Mock: always succeed
	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "If an account exists, a reset email has been sent (mocked).",
	})
}

func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	userID := ctxutil.UserIDFromContext(r.Context())
	tag, err := h.pool.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, userID)
	if err != nil || tag.RowsAffected() == 0 {
		httputil.WriteError(w, http.StatusInternalServerError, "could not delete account")
		return
	}
	h.Logout(w, r)
}

func (h *Handler) setAuthCookie(w http.ResponseWriter, userID string) error {
	token, err := h.createToken(userID)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int((24 * time.Hour * 7).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

func (h *Handler) createToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(h.jwtSecret)
}

func ParseToken(tokenStr string, secret []byte) (string, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil || !token.Valid {
		return "", errors.New("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid claims")
	}
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", errors.New("invalid subject")
	}
	return sub, nil
}

func CookieName() string { return cookieName }

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// Authenticate validates the JWT cookie and returns user ID.
func (h *Handler) Authenticate(r *http.Request) (string, error) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return "", err
	}
	return ParseToken(cookie.Value, h.jwtSecret)
}
