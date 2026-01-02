# Архитектура для Разработчиков

> Детальная техническая архитектура Docker MCP Server для разработчиков

**Версия:** 1.0  
**Обновлено:** 2025-01-XX

---

## 🎯 Обзор

Этот документ описывает внутреннюю архитектуру проекта для разработчиков, которые будут реализовывать или расширять функциональность.

---

## 📦 Технологический Стек

```
┌─────────────────────────────────────────────────────┐
│  TECH STACK                                         │
├─────────────────────────────────────────────────────┤
│  Runtime:        Node.js 18+                       │
│  Language:       TypeScript 5+                     │
│  MCP Protocol:   @modelcontextprotocol/sdk ^0.6.0  │
│  Docker API:     dockerode ^4.0.2                  │
│  YAML Parser:    yaml ^2.3.4                       │
│  Env Parser:     dotenv ^16.4.5                    │
│  Test Runner:    Jest/Vitest (Sprint 3)            │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Архитектурные Слои

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP SERVER LAYER                         │
│  (src/index.ts)                                             │
│  • Регистрация tools                                        │
│  • JSON-RPC обработка                                       │
│  • STDIO transport                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    PROJECT DISCOVERY                        │
│  (src/discovery/)                                           │
│  • Поиск docker-compose.yml                                │
│  • Multi-compose поддержка                                  │
│  • Парсинг YAML                                             │
│  • Определение типов сервисов                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    DOCKERODE CLIENT                         │
│  (src/utils/docker-client.ts)                               │
│  • Инициализация Docker API                                 │
│  • Connection management                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  CONTAINER   │ │  DATABASE    │ │ ENVIRONMENT  │
│  MANAGER     │ │  ADAPTERS    │ │  MANAGER     │
└──────────────┘ └──────────────┘ └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYER                           │
│  (src/security/)                                            │
│  • Маскирование секретов                                   │
│  • SQL валидация (опционально)                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    MCP TOOLS                                │
│  (src/tools/)                                               │
│  • 7 container команд                                      │
│  • 4 database команд                                        │
│  • 3 environment команд                                     │
│  • 1 universal executor                                     │
│  • 1 MCP health tool                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Структура Проекта

```
docker-mcp-server/
├── src/
│   ├── index.ts                          # MCP server entry point
│   │
│   ├── discovery/                        # 🔍 Project Discovery
│   │   ├── project-discovery.ts          #   Основной класс discovery
│   │   ├── compose-parser.ts             #   Парсинг YAML
│   │   ├── config-merger.ts              #   Merge конфигов
│   │   └── types.ts                      #   ProjectConfig, ServiceConfig
│   │
│   ├── adapters/                         # 🔌 Database Adapters
│   │   ├── database-adapter.ts           #   Интерфейс
│   │   ├── adapter-registry.ts           #   Фабрика адаптеров
│   │   ├── postgresql.ts                 #   PostgreSQL adapter
│   │   ├── redis.ts                      #   Redis adapter
│   │   └── sqlite.ts                     #   SQLite adapter
│   │
│   ├── managers/                         # 🎛️ Managers
│   │   ├── container-manager.ts          #   Docker containers
│   │   ├── compose-manager.ts            #   docker-compose
│   │   └── env-manager.ts                #   Environment vars
│   │
│   ├── security/                         # 🔒 Security
│   │   ├── secrets-masker.ts             #   Маскирование секретов
│   │   └── sql-validator.ts              #   SQL validation
│   │
│   ├── tools/                            # 🛠️ MCP Tools
│   │   ├── container-tools.ts            #   7 container команд
│   │   ├── database-tools.ts             #   4 database команд
│   │   ├── env-tools.ts                  #   3 environment команд
│   │   ├── executor-tool.ts              #   1 universal команда
│   │   └── mcp-health-tool.ts           #   1 MCP health команда
│   │
│   └── cli.ts                            # 💻 CLI Interface
│   │
│   └── utils/                            # 🔧 Utilities
│       ├── docker-client.ts              #   Dockerode client
│       ├── logger.ts                     #   Logging (stderr)
│       └── cache.ts                      #   Кеширование
│
├── tests/
│   ├── unit/                             # Unit tests
│   ├── integration/                      # Integration tests
│   └── e2e/                              # E2E tests
│
└── docs/                                 # Документация
```

---

## 🔍 Ключевые Компоненты

### 1. Project Discovery

**Назначение:** Автоматическое обнаружение и парсинг docker-compose.yml

**Основной класс:** `ProjectDiscovery`

**Основные методы:**
```typescript
class ProjectDiscovery {
  // Поиск проекта с опциями
  async findProject(options: DiscoveryOptions): Promise<ProjectConfig>
  
  // Auto-detect compose файлов
  private autoDetectFiles(cwd: string, env?: string): string[]
  
  // Merge конфигов
  private mergeConfigs(files: string[]): ProjectConfig
  
  // Парсинг YAML
  private parseYaml(file: string): any
}
```

**Процесс обнаружения:**
```
1. Если explicitPath → используем его
2. Иначе ищем рекурсивно:
   a. docker-compose.yml (base)
   b. docker-compose.{env}.yml (environment)
   c. docker-compose.override.yml (local)
3. Мержим все файлы (deep merge)
4. Определяем типы сервисов
5. Кешируем результат (60 сек)
```

**Кеширование:**
- TTL: 60 секунд
- Key: absolute path к compose файлу
- Инвалидация: по TTL или при ошибке

---

### 2. Dockerode Client

**Назначение:** Подключение к Docker API

**Основной класс:** `DockerClient` (wrapper над Dockerode)

**Инициализация:**
```typescript
import Docker from 'dockerode';

const docker = new Docker();
// Подключается автоматически к:
// - Mac/Windows: Docker Desktop socket
// - Linux: /var/run/docker.sock

// Проверка подключения
await docker.ping();
```

**Основные операции:**
```typescript
// Containers
const containers = await docker.listContainers({all: true});
const container = docker.getContainer(containerId);
await container.start();
await container.stop();
const logs = await container.logs({follow: true, stdout: true});

// Exec
const exec = await container.exec({
  Cmd: ['npm', 'test'],
  AttachStdout: true,
  AttachStderr: true
});
```

---

### 3. Container Manager

**Назначение:** Управление Docker контейнерами

**Основной класс:** `ContainerManager`

**Основные методы:**
```typescript
class ContainerManager {
  constructor(private docker: Docker) {}
  
  async listContainers(projectName: string): Promise<Container[]>
  async startContainer(serviceName: string, projectName: string): Promise<void>
  async stopContainer(serviceName: string, projectName: string): Promise<void>
  async restartContainer(serviceName: string, projectName: string): Promise<void>
  async getLogs(serviceName: string, options: LogOptions): Promise<string | Stream>
}
```

**Поиск контейнеров:**
- Формат имени: `{projectName}_{serviceName}_{index}`
- Используем `docker.listContainers()` с фильтром по имени проекта
- Маппим service name → container name

---

### 4. Database Adapters

**Назначение:** Абстракция для работы с разными БД

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

**Adapter Registry:**
```typescript
class AdapterRegistry {
  private adapters = new Map<string, DatabaseAdapter>();
  
  register(type: string, adapter: DatabaseAdapter): void
  get(serviceType: string): DatabaseAdapter
}
```

**Определение типа БД:**
```typescript
// По image name в docker-compose.yml
if (image.includes('postgres')) return 'postgresql';
if (image.includes('redis')) return 'redis';
if (image.includes('sqlite')) return 'sqlite';
```

**Connection Info:**
- Читаем из environment variables (`.env` или `docker-compose.yml`)
- PostgreSQL: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Redis: `REDIS_PASSWORD` (опционально)
- SQLite: `SQLITE_DATABASE` (путь к файлу)

---

### 5. Environment Manager

**Назначение:** Управление environment variables

**Основной класс:** `EnvManager`

**Процесс:**
```
1. Читаем .env файлы (в порядке приоритета):
   a. .env (base)
   b. .env.local (local overrides)
   c. .env.{NODE_ENV} (environment-specific)
2. Читаем env из docker-compose.yml
3. Мержим всё вместе
4. Маскируем секреты (если нужно)
```

**Secrets Masking:**
- Keywords: `PASSWORD`, `TOKEN`, `KEY`, `SECRET`, `API_KEY`, `PRIVATE`, `CREDENTIALS`
- Case-insensitive поиск
- Заменяем значение на `***MASKED***`
- Можно отключить через опцию

---

### 6. MCP Tools

**Назначение:** Регистрация MCP commands для AI ассистента

**Регистрация:**
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'docker_container_list',
      description: 'List all containers in the project',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          all: { type: 'boolean', default: true }
        }
      }
    },
    // ... остальные tools
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'docker_container_list':
      return await containerTools.list(args);
    // ... остальные cases
  }
});
```

**Обработка ошибок:**
```typescript
try {
  const result = await manager.listContainers(projectName);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
} catch (error) {
  return {
    content: [{ 
      type: 'text', 
      text: `Error: ${error.message}` 
    }],
    isError: true
  };
}
```

---

## 🔄 Поток Данных

### Пример: docker_container_list

```
1. USER: "Show me all containers"
   ↓
2. CURSOR (AI): Вызывает docker_container_list()
   ↓
3. MCP SERVER: Получает JSON-RPC request
   ↓
4. container-tools.ts: Обрабатывает запрос
   ↓
5. ProjectDiscovery: Находит проект
   ↓
6. ContainerManager: Получает список контейнеров
   ↓
7. Dockerode: docker.listContainers()
   ↓
8. Docker Engine: Возвращает список контейнеров
   ↓
9. ContainerManager: Фильтрует по project name
   ↓
10. container-tools.ts: Форматирует результат
   ↓
11. MCP SERVER: Возвращает JSON-RPC response
   ↓
12. CURSOR (AI): Показывает пользователю список
```

### Пример: docker_db_query

```
1. USER: "Query postgres: SELECT * FROM users"
   ↓
2. CURSOR (AI): Вызывает docker_db_query("postgres", "SELECT * FROM users")
   ↓
3. MCP SERVER: Получает запрос
   ↓
4. database-tools.ts: Обрабатывает запрос
   ↓
5. ProjectDiscovery: Находит проект, определяет тип БД
   ↓
6. AdapterRegistry: Получает PostgreSQLAdapter
   ↓
7. PostgreSQLAdapter: Строит команду psql
   ↓
8. EnvManager: Получает credentials
   ↓
9. docker_exec: Выполняет psql команду в контейнере
   ↓
10. PostgreSQL Container: Выполняет SQL
   ↓
11. PostgreSQLAdapter: Возвращает результат
   ↓
12. database-tools.ts: Форматирует результат
   ↓
13. MCP SERVER: Возвращает JSON-RPC response
   ↓
14. CURSOR (AI): Показывает таблицу пользователей
```

---

## 🔒 Безопасность

### Secrets Masking

**Где применяется:**
- `docker_env_list()` - автоматически
- Все команды, возвращающие environment variables

**Keywords:**
```typescript
const SECRET_KEYWORDS = [
  'PASSWORD',
  'TOKEN',
  'KEY',
  'SECRET',
  'API_KEY',
  'PRIVATE',
  'CREDENTIALS'
];
```

**Алгоритм:**
```typescript
function maskSecrets(env: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(env)) {
    if (isSecret(key)) {
      masked[key] = '***MASKED***';
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}
```

### SQL Validation (опционально)

**Включение:**
```typescript
process.env.DOCKER_MCP_VALIDATE_SQL === 'true'
```

**Паттерны:**
- `DROP DATABASE`
- `DELETE FROM table` (без WHERE)
- `TRUNCATE TABLE`
- `DROP TABLE`

**Использование:**
```typescript
if (process.env.DOCKER_MCP_VALIDATE_SQL === 'true') {
  sqlValidator.validate(sql);
}
```

---

## 🧪 Тестирование

### Unit Tests

**Подход:** Моки для изоляции

**Пример:**
```typescript
// tests/unit/managers/container-manager.test.ts
describe('ContainerManager', () => {
  let docker: jest.Mocked<Docker>;
  let manager: ContainerManager;
  
  beforeEach(() => {
    docker = createMockDocker();
    manager = new ContainerManager(docker);
  });
  
  it('should list containers', async () => {
    docker.listContainers.mockResolvedValue([
      { Id: '123', Names: ['my-project_web_1'], Status: 'running' }
    ]);
    
    const containers = await manager.listContainers('my-project');
    expect(containers).toHaveLength(1);
  });
});
```

### Integration Tests

**Подход:** Реальный Docker (требует запущенного Docker)

**Пример:**
```typescript
// tests/integration/container-workflow.test.ts
describe('Container Workflow', () => {
  beforeAll(async () => {
    // Запустить test containers
    await exec('docker-compose -f docker-compose.test.yml up -d');
  });
  
  afterAll(async () => {
    await exec('docker-compose -f docker-compose.test.yml down');
  });
  
  it('should list containers', async () => {
    const manager = new ContainerManager(docker);
    const containers = await manager.listContainers('test-project');
    expect(containers.length).toBeGreaterThan(0);
  });
});
```

---

## 📊 Производительность

### Кеширование

**Где кешируем:**
- ProjectConfig (60 секунд)
- Environment variables (60 секунд)

**Инвалидация:**
- По TTL
- При ошибке

### Оптимизации

- **Dockerode vs CLI:** Dockerode быстрее (8-10x) благодаря прямому API
- **Lazy loading:** Адаптеры загружаются только когда нужны
- **Streaming:** Logs и exec используют streams для больших данных

---

## 🐛 Обработка Ошибок

### Типы ошибок

1. **Docker не запущен**
   ```typescript
   Error: Docker is not running. Please start Docker Desktop.
   ```

2. **docker-compose.yml не найден**
   ```typescript
   Error: docker-compose.yml not found. Please run from project directory.
   ```

3. **Контейнер не найден**
   ```typescript
   Error: Container 'web' not found in project 'my-project'
   ```

4. **Database connection failed**
   ```typescript
   Error: Failed to connect to PostgreSQL: password incorrect
   ```

### Error Handling Pattern

```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', error);
  throw new Error(`Human-readable message: ${error.message}`);
}
```

---

## 🔗 Зависимости между Модулями

```
index.ts
  ├── tools/container-tools.ts
  │     ├── managers/container-manager.ts
  │     │     └── utils/docker-client.ts
  │     └── discovery/project-discovery.ts
  │
  ├── tools/database-tools.ts
  │     ├── adapters/adapter-registry.ts
  │     │     └── adapters/{postgresql,redis,sqlite}.ts
  │     ├── discovery/project-discovery.ts
  │     └── managers/env-manager.ts
  │
  └── tools/env-tools.ts
        ├── managers/env-manager.ts
        │     └── security/secrets-masker.ts
        └── discovery/project-discovery.ts
```

---

## 📝 Best Practices

### Код

1. **TypeScript strict mode** - использовать везде
2. **Error handling** - всегда try/catch с понятными ошибками
3. **Logging** - использовать logger, не console.log
4. **Async/await** - предпочитать Promise chains

### Архитектура

1. **Separation of concerns** - каждый модуль отвечает за одно
2. **Dependency injection** - передавать зависимости через конструктор
3. **Interface over implementation** - использовать интерфейсы (DatabaseAdapter)
4. **Fail fast** - валидировать входные данные сразу

### Testing

1. **Unit tests** - изолировать с моками
2. **Integration tests** - тестировать реальные workflows
3. **E2E tests** - тестировать критичные пути
4. **Coverage** - стремиться к 80%+

---

## 🔗 Связанные Документы

- [План Разработки](./sprints/SPRINTS.md)
- [API Reference](./API_REFERENCE.md)
- [Database Adapters](./DATABASE_ADAPTERS.md)

---

**Обновлено:** 2025-01-XX  
**Версия:** 1.0

