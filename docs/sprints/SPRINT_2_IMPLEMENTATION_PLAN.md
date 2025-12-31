# Sprint 2: Детальный План Реализации

**Статус:** 📋 ПЛАН  
**Дата создания:** 2025-01-XX  
**Версия:** 1.0

---

## 🎯 ФИНАЛЬНЫЕ РЕШЕНИЯ

✅ **Registry Pattern** - используем для адаптеров  
✅ **Вариант A** - сначала завершаем Sprint 1, потом Database Adapters  
✅ **EnvManager** - создаем полноценный в Sprint 2  
✅ **SQL Validation** - ОБЯЗАТЕЛЬНО, по умолчанию ВКЛ, можно отключить через env var

---

## 📋 ФАЗА 1: ЗАВЕРШЕНИЕ SPRINT 1 (День 0-1)

### Задача 2.0.1: Multi-Compose Support

**Цель:** Поддержка нескольких compose файлов с deep merge

**Файлы:**
- `src/discovery/compose-parser.ts` (расширить)
- `src/discovery/config-merger.ts` (создать)
- `src/discovery/project-discovery.ts` (расширить)

**Архитектура:**

```
ProjectDiscovery.findProject()
  │
  ├─→ autoDetectFiles(cwd, env)
  │     ├─ docker-compose.yml (base)
  │     ├─ docker-compose.{env}.yml (dev/prod/test)
  │     └─ docker-compose.override.yml (local)
  │
  ├─→ parseYaml(file) для каждого файла
  │
  └─→ ConfigMerger.merge([base, env, override])
        └─ Deep merge (как docker-compose делает)
```

**Ключевые методы:**

```typescript
// ConfigMerger.merge(configs: any[]): any
// - Deep merge объектов
// - Конкатенация массивов (ports, volumes)
// - Перезапись примитивов (последний побеждает)

// ProjectDiscovery.autoDetectFiles(cwd, env?): string[]
// - Находит base + env + override файлы
// - Учитывает NODE_ENV
```

**Критерии готовности:**
- ✅ Находит base + env + override файлы
- ✅ Корректно мержит (deep merge)
- ✅ Работает с NODE_ENV

---

### Задача 2.0.2: Кеширование Project Config

**Цель:** Кеш ProjectConfig с TTL 60 сек

**Файл:** `src/utils/cache.ts`

**Архитектура:**

```typescript
Cache<T>
  ├─ Map<string, CacheEntry<T>>
  │   └─ CacheEntry { value, expiresAt }
  │
  └─ Методы:
      ├─ set(key, value) → void
      ├─ get(key) → T | undefined
      ├─ invalidate(key) → void
      └─ clear() → void
```

**Интеграция:**
- Singleton: `projectConfigCache = new Cache<ProjectConfig>(60)`
- Использование в `ProjectDiscovery.findProject()`
- Инвалидация при ошибках

**Критерии готовности:**
- ✅ Кеш работает с TTL 60 сек
- ✅ Инвалидируется при ошибках
- ✅ Улучшает производительность

---

### Задача 2.0.3: Compose Manager

**Цель:** Управление docker-compose стеками

**Файлы:**
- `src/managers/compose-manager.ts` (создать)
- `src/utils/compose-exec.ts` (создать CLI wrapper)

**Архитектура:**

```
ComposeManager
  │
  ├─→ composeUp(options)
  │     └─→ ComposeExec.run(['up', '-d', ...])
  │
  └─→ composeDown(options)
        └─→ ComposeExec.run(['down', ...])

ComposeExec (CLI wrapper)
  └─→ execSync('docker-compose -f ... up -d')
```

**Методы:**

```typescript
// ComposeManager
composeUp(options: ComposeUpOptions): Promise<void>
  - build?: boolean
  - detach?: boolean (default: true)
  - services?: string[]
  - scale?: Record<string, number>

composeDown(options: ComposeDownOptions): Promise<void>
  - volumes?: boolean
  - removeOrphans?: boolean
  - timeout?: number (default: 10)
```

**Критерии готовности:**
- ✅ Запускает все сервисы (up)
- ✅ Останавливает все сервисы (down)
- ✅ Поддерживает build, detach, volumes, scale

---

### Задача 2.0.4: Compose MCP Tools

**Цель:** Зарегистрировать compose команды в MCP

**Файл:** `src/tools/container-tools.ts` (расширить)

**Добавить:**
- `docker_compose_up` tool
- `docker_compose_down` tool
- Интеграция с `ComposeManager`

**Критерии готовности:**
- ✅ Обе команды зарегистрированы
- ✅ Работают через AI ассистента

---

### Задача 2.0.5: Interactive Mode для docker_exec

**Цель:** Поддержка TTY для интерактивных команд

**Файлы:**
- `src/tools/executor-tool.ts` (расширить)
- `src/managers/container-manager.ts` (расширить)

**Изменения:**
- Добавить параметр `interactive?: boolean` в `docker_exec`
- Передать `Tty: true` в `container.exec()`
- Поддержать `AttachStdin` для interactive mode

**Критерии готовности:**
- ✅ Поддерживает interactive mode (TTY)
- ✅ Работает для python REPL, bash, node REPL

---

### Задача 2.0.6: Streaming для Logs Follow Mode

**Цель:** Корректный streaming для follow mode

**Файл:** `src/managers/container-manager.ts` (расширить)

**Изменения:**
- `getLogs()` может вернуть `string | NodeJS.ReadableStream`
- Если `options.follow === true` → возвращаем stream
- Иначе → возвращаем string

**Критерии готовности:**
- ✅ Follow mode работает как stream
- ✅ Корректно обрабатывает поток данных

---

## 📋 ФАЗА 2: ENVIRONMENT MANAGER (День 2)

### Задача 2.1: Environment Manager

**Цель:** Централизованное управление environment variables

**Файл:** `src/managers/env-manager.ts`

**Архитектура:**

```
EnvManager.loadEnv(projectDir, serviceName?)
  │
  ├─→ Загрузить .env файлы (dotenv)
  │     ├─ .env (base)
  │     ├─ .env.{NODE_ENV} (environment-specific)
  │     └─ .env.local (local overrides, highest priority)
  │
  ├─→ Загрузить environment из docker-compose.yml
  │
  └─→ Deep merge (приоритет: .env.local > .env.{env} > .env > compose)
```

**Методы:**

```typescript
loadEnv(projectDir: string, serviceName?: string): Record<string, string>
maskSecrets(env: Record<string, string>): Record<string, string>
```

**Критерии готовности:**
- ✅ Загружает .env файлы
- ✅ Мержит с compose environment
- ✅ Маскирует секреты

---

## 📋 ФАЗА 3: DATABASE ADAPTERS (День 3-5)

### Задача 2.2: Database Adapter Interface

**Файлы:**
- `src/adapters/database-adapter.ts`
- `src/adapters/types.ts`

**Интерфейс:**

```typescript
interface DatabaseAdapter {
  query(service: string, query: string, options?: QueryOptions): Promise<string>;
  backup(service: string, options: BackupOptions): Promise<string>;
  restore(service: string, backupPath: string, options?: RestoreOptions): Promise<void>;
  status(service: string): Promise<DBStatus>;
  getConnectionInfo(service: ServiceConfig, env: Record<string, string>): ConnectionInfo;
}
```

**Типы:**
- `QueryOptions`, `BackupOptions`, `RestoreOptions`
- `DBStatus`, `ConnectionInfo`

**Критерии готовности:**
- ✅ Интерфейс определен
- ✅ Все типы документированы

---

### Задача 2.3: Adapter Registry

**Файл:** `src/adapters/adapter-registry.ts`

**Архитектура:**

```
AdapterRegistry
  ├─ Map<string, DatabaseAdapter>
  │   ├─ "postgresql" → PostgreSQLAdapter
  │   ├─ "postgres"   → PostgreSQLAdapter (alias)
  │   ├─ "redis"      → RedisAdapter
  │   └─ "sqlite"     → SQLiteAdapter
  │
  └─ Методы:
      ├─ register(type, adapter) → void
      ├─ get(type) → DatabaseAdapter
      └─ has(type) → boolean
```

**Критерии готовности:**
- ✅ Регистрирует адаптеры
- ✅ Находит адаптер по типу
- ✅ Понятная ошибка если не найден

---

### Задача 2.4: SQL Validator (Security)

**Файл:** `src/security/sql-validator.ts`

**Опасные паттерны:**
- `DROP DATABASE`
- `DROP TABLE`
- `TRUNCATE TABLE`
- `DELETE FROM table` (без WHERE)
- `UPDATE table SET` (без WHERE)

**Поведение:**
- По умолчанию: **ВКЛ** (защита)
- Отключение: `DOCKER_MCP_VALIDATE_SQL=false`
- Бросает ошибку с понятным сообщением

**Критерии готовности:**
- ✅ Блокирует опасные SQL
- ✅ По умолчанию ВКЛ
- ✅ Можно отключить через env var

---

### Задача 2.5: PostgreSQL Adapter

**Файл:** `src/adapters/postgresql.ts`

**Методы:**
- `query()` - через `psql -U user -d db -c "SQL"`
- `backup()` - через `pg_dump` (форматы: custom, sql, tar)
- `restore()` - через `pg_restore` или `psql`
- `status()` - версия, размер, connections, uptime
- `getConnectionInfo()` - из `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

**Connection Info:**
- Читает из environment через `EnvManager`
- Переменные: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

**Критерии готовности:**
- ✅ Выполняет SQL запросы через psql
- ✅ Создает backup в разных форматах
- ✅ Восстанавливает из backup
- ✅ Возвращает статус БД

---

### Задача 2.6: Redis Adapter

**Файл:** `src/adapters/redis.ts`

**Методы:**
- `query()` - через `redis-cli COMMAND`
- `backup()` - через `SAVE` → копирование `dump.rdb`
- `restore()` - остановка Redis → замена `dump.rdb` → перезапуск
- `status()` - через `INFO` команду (парсинг)
- `getConnectionInfo()` - из `REDIS_PASSWORD` (опционально)

**Критерии готовности:**
- ✅ Выполняет Redis команды
- ✅ Создает backup (dump.rdb)
- ✅ Восстанавливает из backup
- ✅ Возвращает статус

---

### Задача 2.7: SQLite Adapter

**Файл:** `src/adapters/sqlite.ts`

**Методы:**
- `query()` - через `sqlite3 db.sqlite3 "SQL"`
- `backup()` - через `.backup` команду
- `restore()` - копирование файла БД
- `status()` - версия, количество таблиц
- `getConnectionInfo()` - из `SQLITE_DATABASE` (путь к файлу)

**Критерии готовности:**
- ✅ Выполняет SQL запросы
- ✅ Создает backup файл
- ✅ Восстанавливает из backup
- ✅ Возвращает статус

---

### Задача 2.8: Database MCP Tools

**Файл:** `src/tools/database-tools.ts`

**4 команды:**
- `docker_db_query(service, query, options?)`
- `docker_db_backup(service, output?, options?)`
- `docker_db_restore(service, backupPath, options?)`
- `docker_db_status(service, options?)`

**Интеграция:**
- Использует `AdapterRegistry` для выбора адаптера
- Использует `ProjectDiscovery` для определения типа БД
- Использует `SQLValidator` для валидации SQL (если включено)

**Критерии готовности:**
- ✅ Все 4 команды зарегистрированы
- ✅ Используют Adapter Registry
- ✅ Работают через AI ассистента

---

## 🔄 ПОТОК ДАННЫХ: docker_db_query

```
USER: "Query postgres: SELECT * FROM users LIMIT 5;"
  │
  ↓
CURSOR AI: Вызывает docker_db_query("postgres", "SELECT * FROM users LIMIT 5;")
  │
  ↓
MCP SERVER (index.ts)
  │
  ↓
DATABASE TOOLS (database-tools.ts)
  │ • Валидирует параметры
  │ • Вызывает ProjectDiscovery
  │
  ↓
PROJECT DISCOVERY
  │ • Находит docker-compose.yml
  │ • Определяет тип БД: "postgresql"
  │
  ↓
ADAPTER REGISTRY
  │ • registry.get("postgresql")
  │ • Возвращает PostgreSQLAdapter
  │
  ↓
POSTGRESQL ADAPTER
  │ • getConnectionInfo() → credentials
  │ • Строит команду: psql -U user -d db -c "SELECT ..."
  │
  ↓
CONTAINER MANAGER
  │ • exec(service, projectName, ['psql', '-U'...])
  │
  ↓
DOCKER ENGINE
  │ • Выполняет psql внутри контейнера
  │
  ↓
CURSOR AI: Показывает таблицу пользователям
```

---

## 📊 СТРУКТУРА ФАЙЛОВ (После Sprint 2)

```
src/
├── adapters/                       # 🆕 Database Adapters
│   ├── database-adapter.ts         # Интерфейс
│   ├── adapter-registry.ts         # Registry
│   ├── postgresql.ts               # PostgreSQL
│   ├── redis.ts                    # Redis
│   ├── sqlite.ts                   # SQLite
│   └── types.ts                    # Типы
│
├── discovery/
│   ├── compose-parser.ts           # ✅ Расширить
│   ├── config-merger.ts            # 🆕 Deep merge
│   ├── project-discovery.ts        # ✅ Расширить (multi-compose)
│   └── types.ts                    # ✅
│
├── managers/
│   ├── container-manager.ts        # ✅ Расширить (streaming)
│   ├── compose-manager.ts          # 🆕 Compose up/down
│   └── env-manager.ts              # 🆕 Environment
│
├── security/                       # 🆕 Security
│   └── sql-validator.ts           # SQL validation
│
├── tools/
│   ├── container-tools.ts          # ✅ Расширить (compose)
│   ├── database-tools.ts           # 🆕 4 database команды
│   └── executor-tool.ts            # ✅ Расширить (interactive)
│
└── utils/
    ├── cache.ts                    # 🆕 Кеширование
    ├── compose-exec.ts             # 🆕 CLI wrapper
    ├── docker-client.ts            # ✅
    └── logger.ts                   # ✅
```

---

## ✅ CHECKLIST

### Фаза 1: Sprint 1 (День 0-1)
- [ ] 2.0.1: Multi-Compose Support
- [ ] 2.0.2: Кеширование Project Config
- [ ] 2.0.3: Compose Manager
- [ ] 2.0.4: Compose MCP Tools
- [ ] 2.0.5: Interactive Mode для docker_exec
- [ ] 2.0.6: Streaming для Logs Follow Mode

### Фаза 2: Environment Manager (День 2)
- [ ] 2.1: Environment Manager

### Фаза 3: Database Adapters (День 3-5)
- [ ] 2.2: Database Adapter Interface
- [ ] 2.3: Adapter Registry
- [ ] 2.4: SQL Validator
- [ ] 2.5: PostgreSQL Adapter
- [ ] 2.6: Redis Adapter
- [ ] 2.7: SQLite Adapter
- [ ] 2.8: Database MCP Tools

---

**Обновлено:** 2025-01-XX  
**Версия:** 1.0

