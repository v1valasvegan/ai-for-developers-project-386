# Окошко

## Project overview

- `backend/` — Rust + Axum; `frontend/` — React + TypeScript + Vite + Mantine.
- `api/main.tsp` — источник API-контракта; `tests/` — HTTP smoke-тест через сгенерированный SDK.
- Функции бронирования пока не реализованы.

## Build, test and setup commands

- `mise run install` — зависимости и Git-хуки.
- `mise run dev` / `mise run stop` — запуск / остановка серверов; `mise daemons status` — состояние.
- `mise run build` — сборка; `mise run test` — тесты; `mise run lint` — линтер фронтенда.
- `mise run check` — все проверки, включая Rust-линтер, форматирование и безопасность; обязаны пройти до завершения изменения. CI запускает ту же команду.
- `mise run generate` — перегенерация API; `mise run fix` — форматирование с последующей проверкой diff.

## Правила

- Коммиты — Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:` и другие стандартные типы; формат проверяется commitlint.
- `api/generated/`, `frontend/src/api/generated/`, `backend/generated/` генерируются: вручную не редактировать. Проверка повторяет генерацию и обнаруживает расхождения.
- Линт-правила не отключать ради прохождения проверок. Исключение — только узкое, с причиной и согласованием человека; исключения безопасности имеют дату пересмотра.
- `.github/workflows/hexlet-check.yml` управляется Хекслетом: не редактировать и не удалять.
