.PHONY: install dev dev-mock backend-dev stop-backend stop-mock frontend-dev frontend-lint frontend-build api-build api-mock frontend-dev-mock check

API_SPEC := api.tsp
OPENAPI_FILE := api/@typespec/openapi3/openapi.yaml

install:
	npm install
	cd frontend && npm install

dev:
	$(MAKE) stop-backend
	npx -y concurrently -k -n BACKEND,FRONTEND -c green,cyan \
	  "cd backend && APP_PORT=3000 go run ./cmd/server" \
	  "cd frontend && VITE_API_URL=http://localhost:3000/api/v1 npm run dev"

dev-mock: api-build
	$(MAKE) stop-mock
	npx -y concurrently -k -n PRISM,FRONTEND -c magenta,cyan \
	  "npx -y @stoplight/prism-cli mock \"$(OPENAPI_FILE)\" --host 127.0.0.1 --port 4010" \
	  "cd frontend && VITE_API_URL=http://127.0.0.1:4010 npm run dev"

backend-dev:
	$(MAKE) stop-backend
	cd backend && APP_PORT=3000 go run ./cmd/server

stop-backend:
	pkill -f "APP_PORT=3000 go run ./cmd/server" || true
	pkill -f "/tmp/go-build.*/exe/server" || true
	sh -c 'pids=$$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null); [ -z "$$pids" ] || kill $$pids'

stop-mock:
	pkill -f "prism-cli mock .*--port 4010" || true

frontend-dev:
	cd frontend && npm run dev

frontend-lint:
	cd frontend && npm run lint

frontend-build:
	cd frontend && npm run build

api-build:
	npx tsp compile "$(API_SPEC)" --emit "@typespec/openapi3" --output-dir "api"

api-mock: api-build
	npx -y @stoplight/prism-cli mock "$(OPENAPI_FILE)" --host 127.0.0.1 --port 4010

frontend-dev-mock:
	cd frontend && VITE_API_URL=http://127.0.0.1:4010 npm run dev

check: frontend-lint frontend-build api-build
