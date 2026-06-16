package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/dariohefti/toolshare/internal/auth"
	"github.com/dariohefti/toolshare/internal/config"
	"github.com/dariohefti/toolshare/internal/database"
	"github.com/dariohefti/toolshare/internal/groups"
	"github.com/dariohefti/toolshare/internal/middleware"
	"github.com/dariohefti/toolshare/internal/requests"
	"github.com/dariohefti/toolshare/internal/static"
	"github.com/dariohefti/toolshare/internal/tools"
	"github.com/dariohefti/toolshare/internal/users"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if err := database.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	authHandler := auth.NewHandler(pool, cfg.JWTSecret)
	toolHandler := tools.NewHandler(pool)
	groupHandler := groups.NewHandler(pool, toolHandler)
	requestHandler := requests.NewHandler(pool)
	userHandler := users.NewHandler(pool)
	authMW := middleware.NewAuth(authHandler)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)

	r.Get("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/api/v1", func(api chi.Router) {
		api.Route("/auth", func(ar chi.Router) {
			ar.Post("/register", authHandler.Register)
			ar.Post("/login", authHandler.Login)
			ar.Post("/logout", authHandler.Logout)
			ar.Post("/forgot-password", authHandler.ForgotPassword)

			ar.Group(func(protected chi.Router) {
				protected.Use(authMW.Require)
				protected.Get("/me", authHandler.Me)
				protected.Delete("/account", authHandler.DeleteAccount)
			})
		})

		api.Group(func(protected chi.Router) {
			protected.Use(authMW.Require)

			protected.Get("/tools/mine", toolHandler.ListMine)
			protected.Get("/tools/{id}", toolHandler.Get)
			protected.Post("/tools", toolHandler.Create)
			protected.Put("/tools/{id}", toolHandler.Update)
			protected.Delete("/tools/{id}", toolHandler.Delete)
			protected.Post("/tools/{id}/share", toolHandler.Share)
			protected.Delete("/tools/{id}/share/{groupId}", toolHandler.Unshare)

			protected.Get("/groups/mine", groupHandler.ListMine)
			protected.Post("/groups", groupHandler.Create)
			protected.Post("/groups/join", groupHandler.Join)
			protected.Get("/groups/{id}", groupHandler.Get)
			protected.Delete("/groups/{id}", groupHandler.LeaveOrDelete)

			protected.Get("/requests/incoming", requestHandler.ListIncoming)
			protected.Get("/requests/outgoing", requestHandler.ListOutgoing)
			protected.Post("/requests", requestHandler.Create)
			protected.Patch("/requests/{id}", requestHandler.UpdateStatus)

			protected.Get("/users/{id}", userHandler.Get)
		})
	})

	// Serve React SPA for all non-API routes
	r.Handle("/*", static.SPA(cfg.StaticDir))

	srv := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("server listening on http://localhost%s", cfg.Addr())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
}
