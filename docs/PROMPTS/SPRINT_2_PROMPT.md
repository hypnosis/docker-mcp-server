# Промпт для Копирования: Sprint 2 - Database Adapters

> Скопируй этот промпт и используй в новом агенте

---

```
Ты работаешь над Docker MCP Server — универсальным MCP сервером для управления Docker контейнерами через AI ассистентов.

Репозиторий: https://github.com/hypnosis/docker-mcp-server
Статус Sprint 1: ✅ ЗАВЕРШЕН (MVP с Container Management готов)
Текущая задача: Sprint 2: Database Adapters + Задачи из Sprint 1

ВАЖНО: Sprint 2 включает как Database Adapters, так и задачи, отложенные из Sprint 1!

КРИТИЧЕСКИ ВАЖНО - ИЗУЧИ ПЕРЕД НАЧАЛОМ:

1. План Sprint 2: docs/sprints/SPRINT_2_DATABASES.md (детальный план с задачами)
2. Архитектура: docs/DEVELOPER_ARCHITECTURE.md (раздел Database Adapters)
3. Database Adapters Guide: docs/DATABASE_ADAPTERS.md (детальное руководство)
4. GraphML диаграмма: docs/graphml/architecture.graphml (ОБЯЗАТЕЛЬНО сверься - обновлена после Sprint 1!)
5. API Reference: docs/API_REFERENCE.md (раздел Database Operations)

ЧТО УЖЕ ГОТОВО (Sprint 1):
- ✅ MCP Server boilerplate (src/index.ts)
- ✅ Project Discovery (src/discovery/)
- ✅ Dockerode Client (src/utils/docker-client.ts)
- ✅ Container Manager (src/managers/container-manager.ts)
- ✅ Container Tools (src/tools/container-tools.ts)
- ✅ Universal Executor (src/tools/executor-tool.ts)
- ✅ Logger и базовые утилиты

ЗАДАЧИ ИЗ SPRINT 1 (Приоритет: Выполнить в первую очередь):

Задача 2.0.1: Multi-Compose Support
- Реализовать auto-detect файлов (base + env + override)
- Поддержать docker-compose.{env}.yml (prod/dev/test)
- Реализовать deep merge конфигов
- Файлы: src/discovery/compose-parser.ts, src/discovery/config-merger.ts

Задача 2.0.2: Кеширование Project Config
- Создать src/utils/cache.ts
- Реализовать кеширование ProjectConfig (TTL: 60 сек)
- Интегрировать с ProjectDiscovery

Задача 2.0.3: Compose Manager
- Создать src/managers/compose-manager.ts
- Реализовать composeUp() и composeDown()
- Использовать CLI wrapper для docker-compose
- Поддержать параметры: build, detach, volumes

Задача 2.0.4: Compose MCP Tools
- Реализовать docker_compose_up и docker_compose_down
- Зарегистрировать в container-tools.ts
- Интегрировать с MCP server

Задача 2.0.5: Interactive Mode для docker_exec
- Реализовать параметр interactive в executor-tool.ts
- Обработать TTY для interactive mode

Задача 2.0.6: Streaming для Logs Follow Mode
- Реализовать streaming для follow mode в container-manager.ts
- Преобразовать Dockerode stream корректно

ЗАДАЧИ ДЛЯ ВЫПОЛНЕНИЯ (Database Adapters):

Задача 2.1: Database Adapter Interface
- Создать src/adapters/database-adapter.ts (интерфейс)
- Создать src/adapters/types.ts (типы для адаптеров)
- Определить интерфейс DatabaseAdapter с методами:
  * query(service, query, options?) → Promise<string>
  * backup(service, options) → Promise<string>
  * restore(service, backupPath, options?) → Promise<void>
  * status(service) → Promise<DBStatus>
  * getConnectionInfo(service, env) → ConnectionInfo
- Определить типы: QueryOptions, BackupOptions, RestoreOptions, DBStatus, ConnectionInfo

Критерии готовности:
✅ Интерфейс DatabaseAdapter определен
✅ Все типы документированы
✅ Интерфейс готов к реализации

Задача 2.2: Adapter Registry
- Создать src/adapters/adapter-registry.ts
- Реализовать регистрацию адаптеров по типу БД
- Реализовать метод get(type) для получения адаптера
- Поддержать множественные имена (postgres/postgresql, sqlite/sqlite3)
- Добавить fallback на generic adapter (если тип неизвестен)
- Добавить логирование выбора адаптера

Критерии готовности:
✅ Регистрирует адаптеры по типам
✅ Находит адаптер по типу сервиса
✅ Выдает понятную ошибку если адаптер не найден
✅ Поддерживает алиасы (postgres → postgresql)

Задача 2.3: PostgreSQL Adapter — Query
- Создать src/adapters/postgresql.ts
- Реализовать класс PostgreSQLAdapter implements DatabaseAdapter
- Реализовать query() метод:
  * Использовать docker_exec для выполнения psql
  * Парсить connection info из environment (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)
  * Поддержать параметры: database, user, format (table/json/csv)
  * Обработать ошибки SQL
- Реализовать getConnectionInfo() для получения credentials

Критерии готовности:
✅ Выполняет SQL запросы через psql
✅ Получает credentials из environment
✅ Возвращает результат в формате table
✅ Обрабатывает ошибки SQL

Задача 2.4: PostgreSQL Adapter — Backup/Restore
- Реализовать backup() метод:
  * Использовать pg_dump с разными форматами (custom, sql, tar)
  * Поддержать параметры: format, compress, tables, output
  * Сохранять backup в указанный путь
- Реализовать restore() метод:
  * Использовать pg_restore для custom форматов
  * Использовать psql для SQL форматов
  * Поддержать параметры: clean, dataOnly, schemaOnly, database
- Обработать ошибки backup/restore

Критерии готовности:
✅ Создает backup в разных форматах
✅ Восстанавливает из backup
✅ Поддерживает backup отдельных таблиц
✅ Поддерживает clean restore

Задача 2.5: PostgreSQL Adapter — Status
- Реализовать status() метод
- Получить версию PostgreSQL (SELECT version())
- Получить размер БД (pg_database_size)
- Получить количество подключений (pg_stat_activity)
- Получить uptime
- Собрать всё в DBStatus объект

Критерии готовности:
✅ Возвращает версию PostgreSQL
✅ Возвращает размер БД в человекочитаемом формате
✅ Возвращает количество активных подключений
✅ Возвращает uptime
✅ Все данные в структурированном формате

ВАЖНЫЕ ТЕХНИЧЕСКИЕ ДЕТАЛИ:

- Используй уже существующий docker_exec из Sprint 1 (src/tools/executor-tool.ts)
- Connection info читай из environment через EnvManager (будет в Sprint 3, пока можно заготовить)
- PostgreSQL credentials: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
- Все команды выполняются ВНУТРИ контейнера через docker_exec
- Формат backup по умолчанию: 'custom' (pg_dump -Fc) для PostgreSQL
- Ошибки должны быть понятными: "Failed to backup postgres: database not found"

ARCHITECTURE CHECKLIST:
- [ ] Интерфейс DatabaseAdapter соответствует документации
- [ ] Adapter Registry соответствует узлу в GraphML
- [ ] PostgreSQL Adapter соответствует узлу postgresql-adapter в GraphML
- [ ] Связи (edges) соответствуют GraphML:
  * database-tools → adapter-registry
  * adapter-registry → postgresql-adapter
  * postgresql-adapter → container-manager (exec via)
  * postgresql-adapter → env-manager (gets credentials from)

ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:

// Query
const adapter = new PostgreSQLAdapter();
const result = await adapter.query('postgres', 'SELECT * FROM users LIMIT 5;');

// Backup
const backupPath = await adapter.backup('postgres', {
  format: 'custom',
  output: './backup.dump'
});

// Restore
await adapter.restore('postgres', './backup.dump', {
  clean: true
});

// Status
const status = await adapter.status('postgres');
// → { type: 'postgresql', version: '15.3', status: 'healthy', size: '125 MB', ... }

ПОРЯДОК ВЫПОЛНЕНИЯ:

ВАРИАНТ 1: Сначала задачи из Sprint 1 (рекомендуется)
1. Выполни Задачи 2.0.1-2.0.6 (задачи из Sprint 1)
   - Это завершит функциональность Container Management
   - Compose Manager необходим для полноценной работы
2. Затем переходи к Database Adapters (Задачи 2.1-2.5)

ВАРИАНТ 2: Параллельно
- Можно начать с Database Adapters (2.1-2.5)
- Задачи из Sprint 1 делать по мере необходимости

НАЧИНАЙ С:
1. Изучи всю документацию (SPRINT_2_DATABASES.md, DATABASE_ADAPTERS.md, GraphML)
2. Реши какой вариант выбрать (рекомендуется Вариант 1)
3. Выполняй задачи последовательно
4. Сообщи о прогрессе: что сделано, что работает, проблемы

Двигайся итеративно, проверяй часто, сверяйся с архитектурой и существующим кодом!
```

