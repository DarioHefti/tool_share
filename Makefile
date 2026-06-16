.PHONY: db-up db-down run build frontend-build tidy

db-up:
	docker compose up -d

db-down:
	docker compose down

tidy:
	cd backend && go mod tidy

run:
	cd backend && go run ./cmd/server

build: frontend-build
	cd backend && go build -o ../bin/toolshare ./cmd/server

frontend-build:
	cd frontend && npm run build
