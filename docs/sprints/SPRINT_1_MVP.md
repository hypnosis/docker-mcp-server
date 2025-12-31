# Sprint 1: MVP — Container Management

**Статус:** ⏳ Планируется  
**Длительность:** 1 неделя (5 рабочих дней)  
**Приоритет:** 🔴 Высокий

---

## 🎯 Цель Спринта

Создать рабочий MCP сервер с базовым функционалом управления Docker контейнерами. После завершения спринта можно будет управлять контейнерами через AI ассистента (Cursor/Claude Desktop).

---

## 📋 Задачи

### День 1: Project Setup + MCP Boilerplate

#### Задача 1.1: Инициализация проекта
- [ ] Создать структуру папок
- [ ] Настроить `package.json` с зависимостями
- [ ] Настроить `tsconfig.json`
- [ ] Создать `.gitignore`
- [ ] Настроить базовые npm scripts

**Файлы:**
- `package.json`
- `tsconfig.json`
- `.gitignore`

**Зависимости:**
```json
{
  "@modelcontextprotocol/sdk": "^0.6.0",
  "dockerode": "^4.0.2",
  "@types/dockerode": "^3.3.31",
  "yaml": "^2.3.4",
  "dotenv": "^16.4.5"
}
```

**Критерии готовности:**
- ✅ Проект компилируется (`npm run build`)
- ✅ Все зависимости установлены

---

#### Задача 1.2: MCP Server Boilerplate
- [ ] Создать `src/index.ts` (entry point)
- [ ] Инициализировать MCP SDK
- [ ] Настроить STDIO transport
- [ ] Создать базовую структуру сервера
- [ ] Добавить обработку ошибок
- [ ] Добавить логирование (stderr)

**Файлы:**
- `src/index.ts`
- `src/utils/logger.ts`

**Критерии готовности:**
- ✅ Сервер запускается
- ✅ Отвечает на ping/healthcheck
- ✅ Логирует в stderr
- ✅ Обрабатывает базовые ошибки

**Пример кода:**
```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const server = new Server({
    name: 'docker-mcp-server',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // TODO: Register tools
}

main().catch(console.error);
```

---

### День 2: Project Discovery

#### Задача 1.3: Project Discovery — Поиск файлов
- [ ] Создать `src/discovery/project-discovery.ts`
- [ ] Реализовать рекурсивный поиск `docker-compose.yml`
- [ ] Поддержать варианты имен: `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`
- [ ] Реализовать поиск вверх по директориям
- [ ] Добавить обработку ошибок (файл не найден)

**Файлы:**
- `src/discovery/project-discovery.ts`
- `src/discovery/types.ts`

**Критерии готовности:**
- ✅ Находит `docker-compose.yml` рекурсивно
- ✅ Поддерживает все варианты имен
- ✅ Выдает понятную ошибку если файл не найден
- ✅ Работает из любой поддиректории проекта

**Пример использования:**
```typescript
const discovery = new ProjectDiscovery();
const project = await discovery.findProject({ cwd: process.cwd() });
// → { name: 'my-project', composeFile: '/path/to/docker-compose.yml' }
```

---

#### Задача 1.4: Multi-Compose Support
- [ ] Реализовать auto-detect файлов (base + env + override)
- [ ] Поддержать `docker-compose.{env}.yml` (prod/dev/test)
- [ ] Поддержать `docker-compose.override.yml`
- [ ] Реализовать deep merge конфигов
- [ ] Добавить fallback на explicit path

**Файлы:**
- `src/discovery/compose-parser.ts`
- `src/discovery/config-merger.ts`

**Критерии готовности:**
- ✅ Автоматически находит base + env + override файлы
- ✅ Корректно мержит конфиги (как docker-compose)
- ✅ Поддерживает explicit path как override
- ✅ Работает с NODE_ENV

**Пример:**
```typescript
// Структура:
// docker-compose.yml (base)
// docker-compose.dev.yml (env)
// docker-compose.override.yml (local)

const project = await discovery.findProject({
  env: 'dev',  // или auto-detect из NODE_ENV
  cwd: process.cwd()
});
// → Мержит все 3 файла в правильном порядке
```

---

#### Задача 1.5: YAML Parser + Project Config
- [ ] Интегрировать библиотеку `yaml`
- [ ] Парсить docker-compose.yml
- [ ] Извлекать список сервисов
- [ ] Определять типы сервисов (postgres, redis, generic)
- [ ] Создать типы: `ProjectConfig`, `ServiceConfig`
- [ ] Реализовать кеширование (60 секунд)

**Файлы:**
- `src/discovery/compose-parser.ts`
- `src/discovery/types.ts`
- `src/utils/cache.ts`

**Типы:**
```typescript
interface ProjectConfig {
  name: string;
  composeFile: string;
  services: Record<string, ServiceConfig>;
  networks?: Record<string, any>;
  volumes?: Record<string, any>;
}

interface ServiceConfig {
  name: string;
  image?: string;
  build?: any;
  type: 'postgresql' | 'redis' | 'sqlite' | 'generic';
  ports?: string[];
  environment?: Record<string, string>;
}
```

**Критерии готовности:**
- ✅ Парсит docker-compose.yml корректно
- ✅ Извлекает все сервисы
- ✅ Определяет типы БД по image
- ✅ Кеш работает (60 сек TTL)
- ✅ Обрабатывает ошибки парсинга

---

### День 3: Dockerode Client + Container Manager

#### Задача 1.6: Dockerode Client Setup
- [ ] Создать `src/utils/docker-client.ts`
- [ ] Инициализировать Dockerode client
- [ ] Добавить connection test (`docker.ping()`)
- [ ] Добавить обработку ошибок подключения
- [ ] Добавить логирование подключения

**Файлы:**
- `src/utils/docker-client.ts`

**Критерии готовности:**
- ✅ Подключается к Docker daemon
- ✅ Проверяет доступность через ping
- ✅ Выдает понятную ошибку если Docker не запущен
- ✅ Работает на Mac/Windows/Linux

**Пример:**
```typescript
import Docker from 'dockerode';

const docker = new Docker();

// Test connection
try {
  await docker.ping();
  logger.info('Docker connection established');
} catch (error) {
  throw new Error('Docker is not running. Please start Docker Desktop.');
}
```

---

#### Задача 1.7: Container Manager — Базовые операции
- [ ] Создать `src/managers/container-manager.ts`
- [ ] Реализовать `listContainers(projectName)`
- [ ] Реализовать `startContainer(serviceName, projectName)`
- [ ] Реализовать `stopContainer(serviceName, projectName)`
- [ ] Реализовать `restartContainer(serviceName, projectName)`
- [ ] Добавить helper для поиска контейнера по имени

**Файлы:**
- `src/managers/container-manager.ts`
- `src/utils/container-helpers.ts`

**Критерии готовности:**
- ✅ Списывает контейнеры проекта
- ✅ Запускает/останавливает/перезапускает контейнеры
- ✅ Находит контейнеры по имени проекта + сервиса
- ✅ Обрабатывает ошибки (контейнер не найден, уже запущен и т.д.)

**Пример:**
```typescript
const manager = new ContainerManager(docker);

// List containers
const containers = await manager.listContainers('my-project');
// → [{name: 'my-project_web_1', status: 'running', ...}]

// Start container
await manager.startContainer('web', 'my-project');
// → Container 'web' started

// Restart
await manager.restartContainer('web', 'my-project');
```

---

#### Задача 1.8: Container Logs с Follow Mode
- [ ] Реализовать `getLogs(serviceName, options)`
- [ ] Поддержать параметры: `lines`, `follow`, `timestamps`, `since`
- [ ] Реализовать streaming для follow mode
- [ ] Преобразовать Dockerode stream в строку
- [ ] Добавить обработку ошибок

**Файлы:**
- `src/managers/container-manager.ts`

**Критерии готовности:**
- ✅ Получает логи контейнера
- ✅ Поддерживает limit по количеству строк
- ✅ Реализован follow mode (streaming)
- ✅ Форматирует вывод с timestamps
- ✅ Обрабатывает ошибки (контейнер не найден)

**Пример:**
```typescript
// Get last 100 lines
const logs = await manager.getLogs('web', {
  lines: 100,
  timestamps: true
});

// Follow mode (streaming)
const stream = await manager.getLogs('web', {
  follow: true,
  lines: 50
});
stream.on('data', (chunk) => {
  console.log(chunk.toString());
});
```

---

### День 4: Container MCP Tools

#### Задача 1.9: Compose Manager
- [ ] Создать `src/managers/compose-manager.ts`
- [ ] Реализовать `composeUp(options)`
- [ ] Реализовать `composeDown(options)`
- [ ] Поддержать параметры: `build`, `detach`, `services`, `volumes`
- [ ] Использовать dockerode для compose (или CLI wrapper)

**Файлы:**
- `src/managers/compose-manager.ts`

**Примечание:** Dockerode не поддерживает docker-compose напрямую, поэтому используем CLI wrapper или библиотеку `docker-compose`.

**Критерии готовности:**
- ✅ Запускает все сервисы (`docker-compose up`)
- ✅ Останавливает все сервисы (`docker-compose down`)
- ✅ Поддерживает build флаг
- ✅ Поддерживает detach режим
- ✅ Поддерживает удаление volumes

---

#### Задача 1.10: Container MCP Tools — 7 команд
- [ ] Создать `src/tools/container-tools.ts`
- [ ] Реализовать `docker_container_list`
- [ ] Реализовать `docker_container_start`
- [ ] Реализовать `docker_container_stop`
- [ ] Реализовать `docker_container_restart`
- [ ] Реализовать `docker_container_logs`
- [ ] Реализовать `docker_compose_up`
- [ ] Реализовать `docker_compose_down`
- [ ] Зарегистрировать все tools в MCP server

**Файлы:**
- `src/tools/container-tools.ts`
- `src/index.ts` (регистрация tools)

**Критерии готовности:**
- ✅ Все 7 команд зарегистрированы в MCP сервере
- ✅ Каждая команда имеет правильную сигнатуру
- ✅ Команды вызывают соответствующие методы managers
- ✅ Ошибки возвращаются в формате MCP
- ✅ Все команды работают через AI ассистента

**Пример регистрации:**
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
    // ... остальные команды
  ]
}));
```

---

### День 5: Universal Executor + Testing

#### Задача 1.11: Universal Executor
- [ ] Создать `src/tools/executor-tool.ts`
- [ ] Реализовать `docker_exec(service, command, options)`
- [ ] Поддержать параметры: `interactive`, `user`, `workdir`, `env`
- [ ] Использовать Dockerode `container.exec()`
- [ ] Обработать TTY для interactive mode
- [ ] Зарегистрировать tool в MCP server

**Файлы:**
- `src/tools/executor-tool.ts`
- `src/utils/exec-helpers.ts`

**Критерии готовности:**
- ✅ Выполняет команды в контейнере
- ✅ Поддерживает interactive mode (TTY)
- ✅ Поддерживает custom user, workdir
- ✅ Инжектит environment variables
- ✅ Возвращает stdout/stderr

**Пример:**
```typescript
// Run command
const result = await dockerExec('web', 'npm test', {
  workdir: '/app',
  env: { NODE_ENV: 'test' }
});

// Interactive Python REPL
const stream = await dockerExec('web', 'python', {
  interactive: true,
  tty: true
});
```

---

#### Задача 1.12: Интеграция + Тестирование на реальном проекте
- [ ] Собрать все модули вместе
- [ ] Протестировать на Dungeon Mayhem проекте
- [ ] Проверить все 7 container команд
- [ ] Проверить docker_exec (pytest, alembic команды)
- [ ] Исправить найденные баги
- [ ] Обновить документацию

**Критерии готовности:**
- ✅ MCP сервер работает в Cursor/Claude Desktop
- ✅ Все команды выполняются корректно
- ✅ Нет критических ошибок
- ✅ Работает на реальном проекте

**Тестовый сценарий:**
```typescript
// 1. List containers
docker_container_list()
// → Shows: bot, postgres

// 2. Start services
docker_compose_up({build: true})

// 3. Check logs
docker_container_logs('bot', {lines: 50})

// 4. Run tests
docker_exec('bot', 'pytest tests/')

// 5. Run migrations
docker_exec('bot', 'alembic upgrade head')

// 6. Restart service
docker_container_restart('bot')

// 7. Stop services
docker_compose_down()
```

---

## 📊 Метрики Успеха

- ✅ Все 7 container команд работают
- ✅ docker_exec выполняет команды
- ✅ Работает на реальном проекте (Dungeon Mayhem)
- ✅ Нет критических багов
- ✅ MCP сервер стабилен

---

## 🔗 Связанные Документы

- [Архитектура](../../ARCHITECTURE.md)
- [API Reference](../../API_REFERENCE.md) — Container commands
- [Sprint 2: Databases](./SPRINT_2_DATABASES.md)

---

## 📝 Примечания

- **Docker Compose:** Dockerode не поддерживает docker-compose напрямую, используем CLI wrapper или библиотеку
- **Testing:** Функциональное тестирование на реальном проекте, unit tests в Sprint 3
- **Error Handling:** Все ошибки должны быть понятными для пользователя

---

**Обновлено:** 2025-01-XX  
**Версия:** 1.0

