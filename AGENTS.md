# AGENTS.md

## Scope
- Current stack is frontend + contract + in-memory Go backend:
  - `frontend/` - React + Vite + TypeScript + Mantine + React Query
  - `api.tsp` - TypeSpec contract compiled to OpenAPI
  - `backend/` - Go API server (chi) with in-memory storage

## Use Make Targets First
- `make install` - install root and frontend dependencies.
- `make dev` - start Go backend + frontend together (default local entrypoint).
- `make dev-mock` - start Prism + frontend in contract-mock mode.
- `make backend-dev` - start Go backend server on `:3000`.
- `make stop-backend` - stop stale backend process on `:3000`.
- `make stop-mock` - stop stale Prism process on `127.0.0.1:4010`.
- `make frontend-lint` - run frontend lint.
- `make frontend-build` - run frontend typecheck/build.
- `make api-build` - compile `api.tsp` into `api/@typespec/openapi3/openapi.yaml`.
- `make api-mock` - run Prism mock on `127.0.0.1:4010`.
- `make frontend-dev-mock` - run frontend against Prism (`VITE_API_URL=http://127.0.0.1:4010`).
- `make check` - run local verification gate (`frontend-lint`, `frontend-build`, `api-build`).

## API Integration Rules
- Frontend must use API only (no runtime local mocks in UI).
- Backend URL comes from `VITE_API_URL`.
- Default frontend backend URL is `http://localhost:3000/api/v1`.
- Use `make dev-mock` when backend implementation is not the target of current task.

## Contract Workflow
- If `api.tsp` changes, always run `make api-build`.
- Validate frontend behavior against Prism with:
  - terminal 1: `make api-mock`
  - terminal 2: `make frontend-dev-mock`

## Repo-Specific Gotchas
- Do not edit or remove `.github/workflows/hexlet-check.yml`.
- Prism mock responses can differ from final backend wrapper shape; `frontend/src/shared/api.ts` already handles both plain and wrapped responses.

## Current App Structure
- Guest page route: `/`
- Admin page route: `/admin`
- API client: `frontend/src/shared/api.ts`
- API types: `frontend/src/types/api.ts`
- Backend entrypoint: `backend/cmd/server/main.go`

## Agent Defaults
- Prefer minimal, targeted diffs.
- After frontend edits, run at least:
  - `make frontend-lint`
  - `make frontend-build`
- After contract edits, also run `make api-build`.
- For backend changes, run `make backend-dev` and verify endpoint behavior from frontend or curl.
