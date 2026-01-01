# Промпт для Агента: Sprint 3 - Polish (Environment Tools + Tests)

> Используй этот промпт для нового агента, который будет выполнять Sprint 3

---

## 🎯 Контекст Проекта

Ты работаешь над **Docker MCP Server** — универсальным MCP сервером для управления Docker контейнерами через AI ассистентов (Cursor, Claude Desktop).

**Репозиторий:** https://github.com/hypnosis/docker-mcp-server

**Текущая задача:** Реализовать **Sprint 3: Polish — Environment Tools + Tests**

---

## 📚 Критически Важные Документы

**ОБЯЗАТЕЛЬНО ИЗУЧИ ПЕРЕД НАЧАЛОМ:**

1. **План Sprint 3:**
   - `docs/sprints/SPRINT_3_POLISH.md` — детальный план с задачами и критериями готовности

2. **Архитектура:**
   - `docs/DEVELOPER_ARCHITECTURE.md` — техническая архитектура для разработчиков
   - `docs/ARCHITECTURE.md` — общая архитектура системы

3. **Визуализация:**
   - `docs/graphml/architecture.graphml` — GraphML диаграмма архитектуры
   - **ВАЖНО:** Сверяйся с GraphML при реализации — там показаны все связи между модулями

4. **API Reference:**
   - `docs/API_REFERENCE.md` — справочник всех команд (раздел Environment & Config)

5. **Уже реализованные компоненты:**
   - `src/managers/env-manager.ts` — Environment Manager (уже реализован)
   - `src/security/sql-validator.ts` — SQL Validator (уже реализован)

---

## ✅ Что УЖЕ СДЕЛАНО (из Sprint 2)

### Environment Manager ✅
- `src/managers/env-manager.ts` создан и работает
- Загружает .env файлы (.env, .env.local, .env.{NODE_ENV})
- Мержит environment из docker-compose.yml
- Методы: `loadEnv()`, `maskSecrets()`

### Secrets Masker ✅
- Реализован в `EnvManager.maskSecrets()`
- Маскирует: PASSWORD, TOKEN, KEY, SECRET, API_KEY, PRIVATE, CREDENTIALS
- Заменяет значения на `***MASKED***`

### SQL Validator ✅
- `src/security/sql-validator.ts` создан
- Проверяет опасные SQL паттерны
- Включается через `DOCKER_MCP_VALIDATE_SQL` env var

---

## 🎯 Цель Sprint 3

Довести проект до production-ready состояния: добавить Environment MCP Tools и написать тесты.

**Результат после Sprint 3:**
- ✅ 3 команды для работы с environment (docker_env_list, docker_compose_config, docker_healthcheck)
- ✅ Unit tests для всех модулей
- ✅ Integration tests для основных workflows
- ✅ E2E tests для критических путей
- ✅ Code coverage > 80%

---

## 📋 Задачи Sprint 3

### Задача 3.3: Environment MCP Tools — 3 команды

**Что нужно сделать:**
- [ ] Создать `src/tools/env-tools.ts`
- [ ] Реализовать `docker_env_list` — список environment variables
- [ ] Реализовать `docker_compose_config` — показать parsed docker-compose config
- [ ] Реализовать `docker_healthcheck` — проверить здоровье сервисов
- [ ] Зарегистрировать все tools в MCP server (`src/index.ts`)

**Файлы:**
- `src/tools/env-tools.ts` (создать)
- `src/index.ts` (обновить — добавить регистрацию env-tools)

**Интеграция с существующими компонентами:**

```typescript
// env-tools.ts должен использовать:
import { EnvManager } from '../managers/env-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ComposeManager } from '../managers/compose-manager.js';
```

**Критерии готовности:**
- ✅ Все 3 команды зарегистрированы в MCP сервере
- ✅ docker_env_list показывает env vars (с маскированием через EnvManager)
- ✅ docker_compose_config показывает parsed config из ProjectDiscovery
- ✅ docker_healthcheck проверяет здоровье через ContainerManager
- ✅ Все команды работают через AI ассистента

---

#### docker_env_list

**Описание:** Список environment variables из .env файлов и docker-compose.yml.

**Сигнатура:**
```typescript
docker_env_list(options?: {
  project?: string;
  maskSecrets?: boolean;  // default: true
  service?: string;       // опционально: для конкретного сервиса
}): Promise<Record<string, string>>
```

**Реализация:**
```typescript
// Псевдокод
const project = await projectDiscovery.findProject();
const env = envManager.loadEnv(project.projectDir, options.service);

if (options.maskSecrets !== false) {
  return envManager.maskSecrets(env);
}
return env;
```

**Пример использования:**
```typescript
// С маскированием (по умолчанию)
docker_env_list()
// → { NODE_ENV: 'production', DATABASE_PASSWORD: '***MASKED***' }

// Без маскирования
docker_env_list({ maskSecrets: false })

// Для конкретного сервиса
docker_env_list({ service: 'web' })
```

---

#### docker_compose_config

**Описание:** Показать parsed docker-compose конфигурацию.

**Сигнатура:**
```typescript
docker_compose_config(options?: {
  project?: string;
  services?: string[];    // опционально: только указанные сервисы
  resolve?: boolean;      // default: true
}): Promise<string>
```

**Реализация:**
```typescript
// Псевдокод
const project = await projectDiscovery.findProject();
const config = await projectDiscovery.findProject(); // уже содержит parsed config

if (options.services) {
  // Фильтровать только указанные сервисы
  return yaml.stringify(filteredConfig);
}

return yaml.stringify(project.services);
```

**Пример использования:**
```typescript
// Полный config
docker_compose_config()

// Только конкретные сервисы
docker_compose_config({ services: ['web', 'postgres'] })
```

**Примечание:** Для `resolve: false` нужно использовать `parseRaw()` из ComposeParser (если доступен).

---

#### docker_healthcheck

**Описание:** Проверить здоровье всех сервисов (health status из Docker).

**Сигнатура:**
```typescript
docker_healthcheck(options?: {
  project?: string;
  services?: string[];    // опционально: только указанные сервисы
}): Promise<HealthStatus>
```

**Тип возврата:**
```typescript
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'starting' | 'none';
    checks?: number;
    failures?: number;
  }>;
}
```

**Реализация:**
```typescript
// Псевдокод
const project = await projectDiscovery.findProject();
const containers = await containerManager.listContainers(project.name);

const healthStatus = containers.map(container => {
  // Проверить health status из Docker container info
  // Если healthcheck не определён → 'none'
  // Если healthcheck определён → получить из container.State
  return {
    name: container.service,
    status: getHealthStatus(container),
    checks: getChecksCount(container),
    failures: getFailuresCount(container)
  };
});

return {
  overall: calculateOverallStatus(healthStatus),
  services: healthStatus
};
```

**Пример использования:**
```typescript
// Проверить все сервисы
docker_healthcheck()

// Проверить конкретные сервисы
docker_healthcheck({ services: ['web', 'postgres'] })
```

**Примечание:** Health status доступен через `container.State` в Docker API. Нужно проверять формат статуса Docker (например, "health: starting", "health: healthy").

---

### Задача 3.5-3.10: Testing

**Подход:** Тестирование в Sprint 3 должно быть прагматичным — покрыть основные сценарии, не стремиться к 100% coverage.

**Приоритет:**
1. **Unit Tests** для критичных модулей (discovery, managers, adapters)
2. **Integration Tests** для основных workflows
3. **E2E Tests** для критических путей

---

#### Задача 3.5: Unit Tests Infrastructure

**Что нужно сделать:**
- [ ] Выбрать test runner (Jest или Vitest)
- [ ] Настроить конфигурацию
- [ ] Создать структуру тестов
- [ ] Настроить test scripts в `package.json`
- [ ] Добавить coverage reporting
- [ ] Создать mock для Dockerode

**Файлы:**
- `jest.config.js` или `vitest.config.ts`
- `tests/unit/setup.ts`
- `tests/unit/mocks/docker-mock.ts`

**Рекомендация:** Использовать **Vitest** (быстрее, лучше работает с TypeScript ESM).

**Критерии готовности:**
- ✅ Test runner настроен
- ✅ Тесты запускаются через `npm test`
- ✅ Coverage работает
- ✅ Mock для Dockerode создан

---

#### Задача 3.6-3.8: Unit Tests для Модулей

**Приоритет тестирования:**

1. **Discovery** (3.6) — критично для работы системы
   - `project-discovery.test.ts` — поиск compose файлов
   - `compose-parser.test.ts` — парсинг YAML

2. **Managers** (3.7) — базовая бизнес-логика
   - `container-manager.test.ts` (с моками Dockerode)
   - `env-manager.test.ts` — загрузка .env, маскирование секретов

3. **Adapters** (3.8) — опционально, если время позволяет
   - Тесты адаптеров можно отложить, если не хватает времени

**Подход:**
- Использовать моки для Dockerode
- Тестировать основные сценарии + edge cases
- Coverage goal: 70-80% для критичных модулей

---

#### Задача 3.9: Integration Tests

**Что нужно сделать:**
- [ ] Настроить integration tests (требует запущенного Docker)
- [ ] Написать тесты для container workflows (start → stop → restart)
- [ ] Написать тесты для database workflows (query → backup → restore)

**Файлы:**
- `tests/integration/container-workflow.test.ts`
- `tests/integration/database-workflow.test.ts`

**Примечание:** Integration tests требуют запущенного Docker. Можно использовать testcontainers или просто тестировать на реальном проекте.

**Критерии готовности:**
- ✅ Основные workflows покрыты тестами
- ✅ Тесты работают с реальным Docker
- ✅ Можно запускать локально

---

#### Задача 3.10: E2E Tests

**Что нужно сделать:**
- [ ] Написать E2E тесты для критических путей
- [ ] Тест: полный цикл (discovery → list → start → logs → stop)
- [ ] Тест: database query → backup → restore

**Файлы:**
- `tests/e2e/full-workflow.test.ts`
- `tests/e2e/database-workflow.test.ts`

**Критерии готовности:**
- ✅ Критические пути покрыты E2E тестами
- ✅ Тесты работают на реальном проекте
- ✅ Можно запускать вручную

---

## 🔍 Важные Технические Детали

### Использование существующих компонентов

**EnvManager:**
```typescript
import { EnvManager } from '../managers/env-manager.js';

const envManager = new EnvManager();

// Загрузить env
const env = envManager.loadEnv(projectDir, serviceName, serviceConfig);

// Маскировать секреты
const masked = envManager.maskSecrets(env);
```

**ProjectDiscovery:**
```typescript
import { ProjectDiscovery } from '../discovery/project-discovery.js';

const discovery = new ProjectDiscovery();
const project = await discovery.findProject();
// → { name, composeFile, projectDir, services }
```

**ContainerManager:**
```typescript
import { ContainerManager } from '../managers/container-manager.js';

const manager = new ContainerManager();
const containers = await manager.listContainers(project.name);
// → массив с health status в container.State
```

### Формат ответа MCP Tools

```typescript
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify(result, null, 2) // или форматированный текст
    }
  ]
};
```

### Обработка ошибок

Все ошибки должны возвращаться в формате MCP:
```typescript
return {
  content: [
    {
      type: 'text',
      text: `Error: ${error.message}`
    }
  ],
  isError: true
};
```

---

## ✅ Definition of Done

Задача считается выполненной, когда:
- ✅ Код написан и компилируется
- ✅ Соответствует архитектуре (сверь с GraphML)
- ✅ Обрабатывает ошибки с понятными сообщениями
- ✅ Логирует через logger
- ✅ Интегрирован в MCP server (`src/index.ts`)
- ✅ Работает через AI ассистента

---

## 🚀 Начало Работы

1. **Изучи документацию:**
   - Прочитай `docs/sprints/SPRINT_3_POLISH.md` полностью
   - Изучи `src/managers/env-manager.ts` — как использовать
   - Проверь `docs/API_REFERENCE.md` — раздел Environment & Config

2. **Начни с Задачи 3.3:**
   - Создай `src/tools/env-tools.ts`
   - Реализуй 3 команды
   - Зарегистрируй в `src/index.ts`

3. **Затем Testing (3.5-3.10):**
   - Настрой test runner
   - Напиши unit tests для критичных модулей
   - Напиши integration/E2E tests для основных workflows

4. **Сообщи о прогрессе:**
   - После каждой задачи (или блока задач)
   - Укажи что сделано, что работает, какие проблемы

---

## 📝 Примечания

- **Итеративный подход:** Делай маленькими шагами, проверяй часто
- **Сверка с архитектурой:** Регулярно сверяйся с GraphML и DEVELOPER_ARCHITECTURE.md
- **Ошибки:** Всегда обрабатывай ошибки с понятными сообщениями
- **Логирование:** Используй logger для всех важных операций
- **Тестирование:** Фокус на критичных модулях, не гнаться за 100% coverage

---

## 🔗 Полезные Ссылки

- **MCP SDK Docs:** https://modelcontextprotocol.io/
- **Dockerode Docs:** https://github.com/apocas/dockerode
- **Vitest Docs:** https://vitest.dev/
- **Jest Docs:** https://jestjs.io/

---

## 📊 Текущий Прогресс Sprint 3

### ✅ Выполнено:
- ✅ 3.1: Environment Manager (из Sprint 2)
- ✅ 3.2: Secrets Masker (из Sprint 2)
- ✅ 3.4: SQL Validator (из Sprint 2)

### ⏳ В работе:
- ⏳ 3.3: Environment MCP Tools (3 команды)
- ⏳ 3.5-3.10: Testing

### 🎯 Следующие шаги:
1. Реализовать Environment MCP Tools
2. Настроить test infrastructure
3. Написать unit tests
4. Написать integration/E2E tests

---

**Удачи! Начинай с Задачи 3.3 (Environment MCP Tools) и двигайся последовательно. 🚀**

