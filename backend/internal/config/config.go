package config

import (
	"fmt"
	"os"
	"path/filepath"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	StaticDir   string
}

func Load() Config {
	return Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://toolshare:toolshare@localhost:5432/toolshare?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-me"),
		StaticDir:   resolveStaticDir(),
	}
}

// resolveStaticDir finds frontend/dist whether the server is started from the
// repo root (./bin/toolshare) or from backend/ (make run / go run).
func resolveStaticDir() string {
	if v := os.Getenv("STATIC_DIR"); v != "" {
		return v
	}

	candidates := []string{
		"frontend/dist",
		"../frontend/dist",
	}

	if exec, err := os.Executable(); err == nil {
		candidates = append([]string{
			filepath.Join(filepath.Dir(exec), "../frontend/dist"),
		}, candidates...)
	}

	for _, candidate := range candidates {
		indexPath := filepath.Join(candidate, "index.html")
		if info, err := os.Stat(indexPath); err == nil && !info.IsDir() {
			abs, err := filepath.Abs(candidate)
			if err == nil {
				return abs
			}
			return candidate
		}
	}

	return "frontend/dist"
}

func (c Config) Addr() string {
	return fmt.Sprintf(":%s", c.Port)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
