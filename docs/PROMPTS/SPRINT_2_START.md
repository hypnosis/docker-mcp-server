# Промпт для Агента: Sprint 2 - Database Adapters (Начало)

> Детальный промпт для начала Sprint 2

---

## 🎯 Контекст Проекта

Ты работаешь над **Docker MCP Server** — универсальным MCP сервером для управления Docker контейнерами через AI ассистентов (Cursor, Claude Desktop).

**Репозиторий:** https://github.com/hypnosis/docker-mcp-server

**Статус Sprint 1:** ✅ **ЗАВЕРШЕН** (частично)
- ✅ MCP Server boilerplate готов
- ✅ Project Discovery реализован (базовый)
- ✅ Container Manager работает
- ✅ 5 container команд готовы (list, start, stop, restart, logs)
- ✅ Universal Executor (docker_exec) работает (базовый)

**Отложено из Sprint 1 в Sprint 2:**
- ⏳ Multi-compose support (dev/prod/override)
- ⏳ Кеширование конфигурации проекта
- ⏳ Compose Manager (docker-compose up/down)
- ⏳ Streaming для logs follow mode
- ⏳ Interactive mode для docker_exec

**Текущая задача:** Реализовать **Sprint 2: Database Adapters + Задачи из Sprint 1**

---

## 📚 Критически Важные Документы

**ОБЯЗАТЕЛЬНО ИЗУЧИ ПЕРЕД НАЧАЛОМ:**

1. **План Sprint 2:**
   - `docs/sprints/SPRINT_2_DATABASES.md` — детальный план с задачами и критериями готовности

2. **Архитектура:**
   - `docs/DEVELOPER_ARCHITECTURE.md` — раздел "Database Adapters" и "4. Database Adapters"
   - `docs/ARCHITECTURE.md` — общая архитектура (раздел Database Adapter Pattern)

3. **Database Adapters Guide:**
   - `docs/DATABASE_ADAPTERS.md` — детальное руководство по созданию адаптеров
   - Примеры реализации PostgreSQL, Redis, SQLite адаптеров

4. **Визуализация:**
   - `docs/graphml/architecture.graphml` — GraphML диаграмма архитектуры
   - **ВАЖНО:** Сверяйся с GraphML — там показаны все связи адаптеров
   - Обрати внимание на узлы: `adapter-registry`, `postgresql-adapter`, `database-tools`

5. **API Reference:**
   - `docs/API_REFERENCE.md` — раздел "Database Operations"
   - Все 4 команды: docker_db_query, docker_db_backup, docker_db_restore, docker_db_status

6. **Существующий код (изучи!):**
   - `src/tools/executor-tool.ts` — как использовать docker_exec
   - `src/discovery/project-discovery.ts` — как определять типы сервисов
   - `src/managers/container-manager.ts` — пример работы с Dockerode

---

## 🎯 Цель Sprint 2

**Часть 1:** Завершить задачи из Sprint 1
- Multi-compose support
- Кеширование
- Compose Manager и команды
- Interactive mode для docker_exec
- Streaming для logs

**Часть 2:** Реализовать Database Adapters
- PostgreSQL, Redis, SQLite адаптеры
- 4 database команды

**Результат после Sprint 2:**
- ✅ Все задачи из Sprint 1 завершены
- ✅ Database Adapter интерфейс определен
- ✅ Все 3 адаптера работают
- ✅ Все 4 database команды работают

---

## 📋 Задачи

### День 0: Задачи из Sprint 1 (Приоритет: Высокий)

**ВАЖНО:** Эти задачи нужно выполнить в первую очередь, чтобы завершить функциональность Container Management!

#### Задача 2.0.1: Multi-Compose Support

**Что нужно сделать:**
- [ ] Расширить `src/discovery/compose-parser.ts`
- [ ] Создать `src/discovery/config-merger.ts`
- [ ] Реализовать auto-detect файлов:
  - docker-compose.yml (base)
  - docker-compose.{env}.yml (environment: prod/dev/test)
  - docker-compose.override.yml (local overrides)
- [ ] Реализовать deep merge конфигов (как делает docker-compose)
- [ ] Поддержать auto-detect из NODE_ENV
- [ ] Интегрировать с ProjectDiscovery

**Критерии готовности:**
- ✅ Автоматически находит все compose файлы
- ✅ Корректно мержит конфиги в правильном порядке
- ✅ Работает с NODE_ENV для auto-detect

---

#### Задача 2.0.2: Кеширование Project Config

**Что нужно сделать:**
- [ ] Создать `src/utils/cache.ts`
- [ ] Реализовать кеш с TTL (60 секунд)
- [ ] Кешировать ProjectConfig по абсолютному пути к compose файлу
- [ ] Инвалидировать кеш при ошибках
- [ ] Интегрировать с ProjectDiscovery

**Критерии готовности:**
- ✅ Кеш работает с TTL 60 секунд
- ✅ Инвалидируется при ошибках
- ✅ Улучшает производительность

---

#### Задача 2.0.3: Compose Manager

**Что нужно сделать:**
- [ ] Создать `src/managers/compose-manager.ts`
- [ ] Создать `src/utils/compose-exec.ts` (CLI wrapper)
- [ ] Реализовать `composeUp(options)`:
  - Использовать CLI wrapper для `docker-compose up`
  - Поддержать параметры: build, detach, services, volumes
- [ ] Реализовать `composeDown(options)`:
  - Использовать CLI wrapper для `docker-compose down`
  - Поддержать параметры: volumes, timeout
- [ ] Работать с multi-compose файлами

**Критерии готовности:**
- ✅ Запускает все сервисы
- ✅ Останавливает все сервисы
- ✅ Поддерживает все параметры
- ✅ Работает с multi-compose

---

#### Задача 2.0.4: Compose MCP Tools

**Что нужно сделать:**
- [ ] Расширить `src/tools/container-tools.ts`
- [ ] Реализовать `docker_compose_up`
- [ ] Реализовать `docker_compose_down`
- [ ] Зарегистрировать tools в MCP server

**Критерии готовности:**
- ✅ Обе команды зарегистрированы
- ✅ Используют ComposeManager
- ✅ Работают через AI ассистента

---

#### Задача 2.0.5: Interactive Mode для docker_exec

**Что нужно сделать:**
- [ ] Расширить `src/tools/executor-tool.ts`
- [ ] Реализовать поддержку параметра `interactive: boolean`
- [ ] Настроить TTY для interactive mode
- [ ] Протестировать на интерактивных командах (python, bash)

**Критерии готовности:**
- ✅ Interactive mode работает
- ✅ TTY правильно настроен
- ✅ Работает для интерактивных команд

---

#### Задача 2.0.6: Streaming для Logs Follow Mode

**Что нужно сделать:**
- [ ] Расширить `src/managers/container-manager.ts`
- [ ] Реализовать streaming для follow mode
- [ ] Правильно преобразовать Dockerode stream
- [ ] Протестировать follow mode

**Критерии готовности:**
- ✅ Follow mode работает как stream
- ✅ Корректно обрабатывает поток данных

---

### День 1: Database Adapter Infrastructure

#### Задача 2.1: Database Adapter Interface

**Что нужно сделать:**
- [ ] Создать `src/adapters/database-adapter.ts`
- [ ] Определить интерфейс `DatabaseAdapter`
- [ ] Создать `src/adapters/types.ts`
- [ ] Определить типы: `QueryOptions`, `BackupOptions`, `RestoreOptions`, `DBStatus`, `ConnectionInfo`

**Интерфейс DatabaseAdapter:**
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
```typescript
interface QueryOptions {
  database?: string;
  user?: string;
  format?: 'table' | 'json' | 'csv';
}

interface BackupOptions {
  output?: string;
  format?: 'sql' | 'custom' | 'tar' | 'directory';
  compress?: boolean;
  tables?: string[];
}

interface RestoreOptions {
  database?: string;
  clean?: boolean;
  dataOnly?: boolean;
  schemaOnly?: boolean;
}

interface DBStatus {
  type: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  size?: string;
  connections?: number;
  uptime?: string;
  memory?: string;
  additional?: Record<string, any>;
}

interface ConnectionInfo {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}
```

**Критерии готовности:**
- ✅ Интерфейс определен и экспортирован
- ✅ Все типы документированы
- ✅ Интерфейс готов к реализации

---

### Задача 2.2: Adapter Registry

**Что нужно сделать:**
- [ ] Создать `src/adapters/adapter-registry.ts`
- [ ] Реализовать класс `AdapterRegistry`
- [ ] Реализовать метод `register(type, adapter)`
- [ ] Реализовать метод `get(serviceType)` с fallback
- [ ] Поддержать множественные имена (postgres/postgresql)
- [ ] Добавить логирование через logger

**Пример:**
```typescript
class AdapterRegistry {
  private adapters = new Map<string, DatabaseAdapter>();
  
  register(type: string, adapter: DatabaseAdapter): void {
    this.adapters.set(type.toLowerCase(), adapter);
  }
  
  get(serviceType: string): DatabaseAdapter {
    const adapter = this.adapters.get(serviceType.toLowerCase());
    if (!adapter) {
      throw new Error(`No adapter found for database type: ${serviceType}`);
    }
    return adapter;
  }
}
```

**Критерии готовности:**
- ✅ Регистрирует адаптеры по типам
- ✅ Находит адаптер по типу сервиса
- ✅ Выдает понятную ошибку если адаптер не найден
- ✅ Поддерживает алиасы (postgres → postgresql)

---

### Задача 2.3: PostgreSQL Adapter — Query

**Что нужно сделать:**
- [ ] Создать `src/adapters/postgresql.ts`
- [ ] Реализовать класс `PostgreSQLAdapter implements DatabaseAdapter`
- [ ] Реализовать `query()` метод:
  - Использовать docker_exec (через ContainerManager или напрямую)
  - Строить команду: `psql -U {user} -d {database} -c "{query}"`
  - Получать connection info из environment
  - Поддержать параметры: database, user, format
- [ ] Реализовать `getConnectionInfo()`:
  - Читать POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB из env
  - Возвращать ConnectionInfo объект

**Connection Info из environment:**
```typescript
// Из .env или docker-compose.yml:
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=mydb
```

**Пример query:**
```typescript
const conn = this.getConnectionInfo(service, env);
const command = `psql -U ${conn.user} -d ${conn.database} -c "${sql}"`;
const result = await dockerExec(service, command);
```

**Критерии готовности:**
- ✅ Выполняет SQL запросы через psql
- ✅ Получает credentials из environment
- ✅ Возвращает результат в формате table
- ✅ Обрабатывает ошибки SQL

---

### Задача 2.4: PostgreSQL Adapter — Backup/Restore

**Что нужно сделать:**

**Backup:**
- [ ] Реализовать `backup()` метод
- [ ] Использовать `pg_dump` с форматами:
  - custom: `-Fc` (compressed)
  - sql: `-Fp` (plain SQL)
  - tar: `-Ft` (tar format)
- [ ] Поддержать backup отдельных таблиц (`-t table1 -t table2`)
- [ ] Сохранять в указанный путь или генерировать автоматически

**Restore:**
- [ ] Реализовать `restore()` метод
- [ ] Для custom формата: `pg_restore`
- [ ] Для SQL формата: `psql < backup.sql`
- [ ] Поддержать флаги: `--clean`, `--data-only`, `--schema-only`

**Пример backup:**
```typescript
const conn = this.getConnectionInfo(service, env);
let command = `pg_dump -U ${conn.user} -d ${conn.database}`;

if (format === 'custom') {
  command += ' -Fc';  // Custom format (compressed)
} else if (format === 'sql') {
  command += ' -Fp';  // Plain SQL
}

if (options.tables && options.tables.length > 0) {
  options.tables.forEach(table => {
    command += ` -t ${table}`;
  });
}

command += ` -f ${output}`;
await dockerExec(service, command);
```

**Критерии готовности:**
- ✅ Создает backup в разных форматах
- ✅ Восстанавливает из backup
- ✅ Поддерживает backup отдельных таблиц
- ✅ Поддерживает clean restore

---

### Задача 2.5: PostgreSQL Adapter — Status

**Что нужно сделать:**
- [ ] Реализовать `status()` метод
- [ ] Получить версию: `SELECT version()`
- [ ] Получить размер БД: `SELECT pg_size_pretty(pg_database_size(current_database()))`
- [ ] Получить подключения: `SELECT count(*) FROM pg_stat_activity`
- [ ] Получить uptime: `SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time())`
- [ ] Собрать всё в DBStatus объект

**Пример:**
```typescript
const version = await this.query(service, 'SELECT version()');
const size = await this.query(service, 
  "SELECT pg_size_pretty(pg_database_size(current_database()))");
const connections = await this.query(service,
  'SELECT count(*) FROM pg_stat_activity');

return {
  type: 'postgresql',
  version: this.parseVersion(version),
  status: 'healthy',
  size: size.trim(),
  connections: parseInt(connections.trim()),
  // ...
};
```

**Критерии готовности:**
- ✅ Возвращает версию PostgreSQL
- ✅ Возвращает размер БД в человекочитаемом формате
- ✅ Возвращает количество активных подключений
- ✅ Возвращает uptime
- ✅ Все данные в структурированном формате

---

## 🔍 Важные Технические Детали

### Использование Существующего Кода

**docker_exec:**
- Используй уже реализованный `docker_exec` из Sprint 1
- Находится в `src/tools/executor-tool.ts` или можно вызвать через ContainerManager
- Все команды выполняются ВНУТРИ контейнера

**Project Discovery:**
- Тип БД определяется в ProjectDiscovery по image name
- Используй существующую логику определения типа сервиса

**Environment Variables:**
- Пока можно заготовить чтение из process.env или передавать env объект
- EnvManager будет реализован в Sprint 3, но интерфейс можно использовать уже сейчас

### PostgreSQL Специфика

**Credentials:**
- POSTGRES_USER (по умолчанию: 'postgres')
- POSTGRES_PASSWORD (обязательно)
- POSTGRES_DB (по умолчанию: 'postgres')

**Команды:**
- Query: `psql -U {user} -d {db} -c "{sql}"`
- Backup: `pg_dump -U {user} -d {db} -F{format} -f {output}`
- Restore custom: `pg_restore -U {user} -d {db} {backup}`
- Restore SQL: `psql -U {user} -d {db} < {backup}`

### Обработка Ошибок

Все ошибки должны быть понятными:
```typescript
try {
  // ...
} catch (error) {
  throw new Error(`Failed to backup PostgreSQL database: ${error.message}`);
}
```

---

## 📖 Сверка с GraphML

**ВАЖНО:** Открой `docs/graphml/architecture.graphml` и сверься с диаграммой.

**Проверь связи:**
- ✅ `database-tools` → `adapter-registry` (uses)
- ✅ `adapter-registry` → `postgresql-adapter` (manages)
- ✅ `postgresql-adapter` → `container-manager` (exec via)
- ✅ `postgresql-adapter` → `env-manager` (gets credentials from)

**Структура файлов:**
- `src/adapters/database-adapter.ts` (interface)
- `src/adapters/adapter-registry.ts` (registry node)
- `src/adapters/postgresql.ts` (postgresql-adapter node)
- `src/adapters/types.ts` (types)

---

## ✅ Definition of Done

Задача считается выполненной, когда:
- ✅ Код написан и компилируется
- ✅ Соответствует архитектуре (сверь с GraphML)
- ✅ Интерфейс DatabaseAdapter реализован корректно
- ✅ PostgreSQL adapter работает (query, backup, restore, status)
- ✅ Обрабатывает ошибки с понятными сообщениями
- ✅ Можно протестировать на реальном проекте с PostgreSQL

---

## 🚀 Начало Работы

1. **Изучи документацию:**
   - Прочитай `docs/sprints/SPRINT_2_DATABASES.md` полностью
   - Изучи `docs/DATABASE_ADAPTERS.md` (примеры реализации)
   - Открой GraphML диаграмму
   - Изучи существующий код (executor-tool, container-manager)

2. **Начни с Задачи 2.1:**
   - Создай интерфейс DatabaseAdapter
   - Определи все типы

3. **Затем Задача 2.2:**
   - Создай Adapter Registry

4. **Затем Задачи 2.3-2.5:**
   - Реализуй PostgreSQL Adapter полностью

5. **Сообщи о прогрессе:**
   - После каждой задачи
   - Укажи что сделано, что работает, какие проблемы

---

## 📝 Примечания

- **Итеративный подход:** Делай маленькими шагами, проверяй часто
- **Сверка с архитектурой:** Регулярно сверяйся с GraphML и DATABASE_ADAPTERS.md
- **Используй существующий код:** docker_exec уже реализован, используй его
- **Тестирование:** Можно протестировать на реальном проекте с PostgreSQL (Dungeon Mayhem)

---

## 🔗 Полезные Ссылки

- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **pg_dump/pg_restore:** https://www.postgresql.org/docs/current/app-pgdump.html
- **DATABASE_ADAPTERS.md:** Примеры реализации адаптеров

---

**Удачи! Начинай с Задачи 2.1 и двигайся последовательно. 🚀**

