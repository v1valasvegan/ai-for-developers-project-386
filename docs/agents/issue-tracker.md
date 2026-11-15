# Трекер задач: GitHub

Задачи и спецификации живут в GitHub Issues репозитория `v1valasvegan/ai-for-developers-project-386`. Для операций использовать `gh` из клона репозитория; `gh` определяет его по настройкам удалённого репозитория Git.

## Операции

- Создать задачу: `gh issue create --title "..." --body-file <file>`. Для многострочного текста использовать файл или многострочный ввод с `--body-file -`.
- Прочитать задачу и комментарии: `gh issue view <number> --comments`; получить описание и метки: `gh issue view <number> --json number,title,body,labels,comments`.
- Найти открытые задачи: `gh issue list --state open --json number,title,body,labels,comments`; при необходимости добавить `--label` или изменить `--state`.
- Добавить комментарий: `gh issue comment <number> --body "..."`.
- Добавить или убрать метки: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`. Соответствия ролей — в `docs/agents/triage-labels.md`.
- Закрыть задачу: `gh issue close <number> --comment "..."`.

«Опубликовать в трекер» означает создать задачу в GitHub Issues. «Получить задачу» означает прочитать её описание, метки и комментарии.

## Запросы на слияние как входящие заявки

**PRs as a request surface: no.** Запрос на слияние (PR) не считается входящей заявкой для разбора. Служебный флаг можно изменить здесь, если процесс работы изменится.

Нумерация задач и PR общая: если ссылка неоднозначна, проверить тип через `gh pr view <number>`, затем при необходимости использовать `gh issue view <number>`.

## Wayfinding operations

Планирование больших задач. Служебное название раздела сохранено для совместимости с `/wayfinder`.

Для `/wayfinder` карта — одна задача с меткой `wayfinder:map`, дочерние задачи — её подзадачи.

- Связывать подзадачи через API подзадач GitHub (`gh api`). Если подзадачи недоступны, использовать список задач с флажками в описании карты и строку `Part of #<map>` в дочерней задаче.
- Типы дочерних задач обозначать метками `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`.
- Зависимости задавать через встроенные зависимости задач GitHub: `gh api --method POST repos/v1valasvegan/ai-for-developers-project-386/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. Числовой идентификатор задачи в базе данных получить через `gh api repos/v1valasvegan/ai-for-developers-project-386/issues/<blocker> --jq .id`; это не номер задачи и не `node_id`.
- Если зависимости недоступны, записывать `Blocked by: #<n>, #<n>` в начале описания. Задача разблокирована, когда все блокирующие задачи закрыты.
- Выбирать первую по порядку карты открытую дочернюю задачу без исполнителя и открытых блокеров. Для встроенных зависимостей проверять `issue_dependencies_summary.blocked_by`.
- При взятии задачи назначать исполнителя: `gh issue edit <number> --add-assignee @me`.
- При завершении записывать результат комментарием, закрывать задачу и добавлять краткое решение со ссылкой в раздел принятых решений (`Decisions-so-far`) карты.
