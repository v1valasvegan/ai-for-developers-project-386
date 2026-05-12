### Hexlet tests and linter status:
[![Actions Status](https://github.com/v1valasvegan/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/v1valasvegan/ai-for-developers-project-386/actions)

## Frontend

Frontend is implemented as a separate app in `frontend/` with:

- React
- Vite
- TypeScript
- Mantine UI
- React Query

### Quick start (make)

```bash
make install
make dev
```

`make dev` runs Go backend and frontend together.

Use mock mode when needed:

```bash
make dev-mock
```

`make dev-mock` runs Prism mock and frontend together (frontend points to `http://127.0.0.1:4010`).

If port `4010` is busy from an old Prism process, run:

```bash
make stop-mock
```

If port `3000` is busy from an old backend process, run:

```bash
make stop-backend
```

### Run directly

```bash
cd frontend
npm install
npm run dev
```

Set backend URL through env variable:

```bash
VITE_API_URL=http://localhost:3000/api/v1
```

### Contract and Prism

```bash
make api-build
make api-mock
make frontend-dev-mock
```

### Implemented pages

- Guest page (`/`): event type list, slot selection for 14-day window, booking form.
- Admin page (`/admin`): create/edit event types, view upcoming bookings.

All UI actions are connected to the API contract and use HTTP only.

## Backend (Go, in-memory)

Backend is implemented in `backend/` and serves API for frontend client.

- run backend: `make backend-dev`
- default port: `3000`
- health check: `GET http://localhost:3000/healthz`

Storage is in-memory for this stage (data resets on service restart).

## MCP setup

- Render MCP (OpenCode): see `docs/mcp-render.md`

## Docker deploy

- Docker image is built from root `Dockerfile`.
- Container starts app automatically.
- App listens on `PORT` env variable.

Build and run locally:

```bash
docker build -t hexlet-ai-fe .
docker run --rm -e PORT=3000 -p 3000:3000 hexlet-ai-fe
```

Public app URL: `https://<your-render-service>.onrender.com`
