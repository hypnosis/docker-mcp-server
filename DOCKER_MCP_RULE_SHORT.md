# MCP Серверы

git-official (локальный Git):
- Локальные операции: add, commit, status, diff, branch, checkout, log, push, pull

github (GitHub API):
- Создание Pull Requests
- Управление Issues
- Code review через PR
- Получение данных через API

docker (@hypnosis/docker-mcp-server):
- Управление контейнерами: list, start, stop, restart, logs
- Работа с БД: query, backup, restore, status (PostgreSQL, Redis, SQLite)
- Выполнение команд: exec("service", "command")
- Окружение: env_list() с маскированием секретов
- Мониторинг: healthcheck()

Дерево решений:
Локальная операция Git → git-official
GitHub API операция → github
Docker операция → docker-mcp инструменты
Сомневаешься → git-official для Git, docker-mcp для Docker

Правила:
1. Не дублировать операции
2. Локальные операции Git → git-official
3. GitHub API → github
4. ВСЕГДА используй docker-mcp инструменты вместо `docker`/`docker-compose` команд в терминале
5. Auto-discovery: сервер найдёт docker-compose.yml автоматически. Используй имена сервисов из compose ("web", "postgres"), НЕ container ID

Примеры docker-mcp:
"Запусти web сервис" → docker_container_start("web")
"Покажи логи" → docker_container_logs("web", {lines: 100})
"SELECT запрос" → docker_db_query("postgres", "SELECT * FROM users")
"Бэкап БД" → docker_db_backup("postgres")
"Запусти тесты" → docker_exec("web", "npm test")
