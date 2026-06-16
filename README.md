# Tool Share

Share tools with friends and neighbors.

## Prerequisites

- [Go](https://go.dev/) 1.22+
- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/)

## Run locally

```bash
make db-up                          # start Postgres
cd frontend && npm install && cd .. # first time only
make run                            # API on :8080 (migrations run automatically)
```

In a second terminal:

```bash
cd frontend && npm run dev          # UI on http://localhost:5173
```

The Vite dev server proxies `/api` to the backend.

## Production build

```bash
make build                          # builds frontend + backend binary
./bin/toolshare                     # serves UI + API on :8080
```

## Config (optional)

| Variable       | Default                                                              |
|----------------|----------------------------------------------------------------------|
| `PORT`         | `8080`                                                               |
| `DATABASE_URL` | `postgres://toolshare:toolshare@localhost:5432/toolshare?sslmode=disable` |
| `JWT_SECRET`   | `dev-secret-change-me`                                               |
