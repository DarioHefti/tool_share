package middleware

import (
	"net/http"

	"github.com/dariohefti/toolshare/internal/ctxutil"
	"github.com/dariohefti/toolshare/internal/httputil"
)

type Authenticator interface {
	Authenticate(r *http.Request) (string, error)
}

type Auth struct {
	Auth Authenticator
}

func NewAuth(a Authenticator) *Auth {
	return &Auth{Auth: a}
}

func (a *Auth) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, err := a.Auth.Authenticate(r)
		if err != nil {
			httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(ctxutil.WithUserID(r.Context(), userID)))
	})
}
