package static

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// SPA serves a static frontend directory with fallback to index.html for client routing.
func SPA(root string) http.Handler {
	fileServer := http.FileServer(http.Dir(root))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && !strings.HasPrefix(r.URL.Path, "/api") {
			path := filepath.Join(root, filepath.Clean("/"+r.URL.Path))
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		indexPath := filepath.Join(root, "index.html")
		if _, err := os.Stat(indexPath); err != nil {
			http.Error(w, "frontend not built: run `npm run build` in frontend/", http.StatusNotFound)
			return
		}
		http.ServeFile(w, r, indexPath)
	})
}

// FromEmbed serves files from an embedded FS (subdirectory "dist").
func FromEmbed(fsys fs.FS) http.Handler {
	sub, err := fs.Sub(fsys, "dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "embedded frontend missing", http.StatusNotFound)
		})
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && !strings.HasPrefix(r.URL.Path, "/api") {
			if f, err := sub.Open(strings.TrimPrefix(r.URL.Path, "/")); err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		data, err := fs.ReadFile(sub, "index.html")
		if err != nil {
			http.Error(w, "index.html not found in embedded frontend", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	})
}
