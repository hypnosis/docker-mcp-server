# Промпт для Копирования: Sprint 1 - Начало

> Скопируй этот промпт и используй в новом агенте

---

```
Ты работаешь над Docker MCP Server — универсальным MCP сервером для управления Docker контейнерами через AI ассистентов.

Репозиторий: https://github.com/hypnosis/docker-mcp-server
Текущая задача: Sprint 1: MVP - Container Management (День 1, Задачи 1.1 и 1.2)

КРИТИЧЕСКИ ВАЖНО - ИЗУЧИ ПЕРЕД НАЧАЛОМ:

1. План Sprint 1: docs/sprints/SPRINT_1_MVP.md (детальный план с задачами)
2. Архитектура: docs/DEVELOPER_ARCHITECTURE.md (техническая архитектура)
3. GraphML диаграмма: docs/graphml/architecture.graphml (ОБЯЗАТЕЛЬНО открой и сверяйся!)
4. API Reference: docs/API_REFERENCE.md (раздел Container Management)

ЗАДАЧИ ДЛЯ ВЫПОЛНЕНИЯ:

Задача 1.1: Инициализация проекта
- Создать структуру папок (src/, tests/, docs/)
- Настроить package.json с зависимостями:
  * @modelcontextprotocol/sdk: ^0.6.0
  * dockerode: ^4.0.2
  * @types/dockerode: ^3.3.31
  * yaml: ^2.3.4
  * dotenv: ^16.4.5
  * typescript: ^5.0.0
- Настроить tsconfig.json (TypeScript 5+, strict mode)
- Создать .gitignore
- Настроить npm scripts (build, start, dev)

Критерии готовности:
✅ Проект компилируется (npm run build)
✅ Все зависимости установлены
✅ Структура соответствует архитектуре

Задача 1.2: MCP Server Boilerplate
- Создать src/index.ts (MCP server entry point)
- Инициализировать MCP SDK с STDIO transport
- Создать src/utils/logger.ts (логирование через stderr)
- Добавить базовую обработку ошибок

Критерии готовности:
✅ Сервер запускается (npm start)
✅ Логирует в stderr через logger
✅ Обрабатывает базовые ошибки

ВАЖНЫЕ ТЕХНИЧЕСКИЕ ДЕТАЛИ:

- Используем Dockerode (Docker SDK), НЕ CLI
- TypeScript strict mode обязателен
- Logging только через stderr (стандарт MCP)
- Всегда понятные сообщения об ошибках
- Сверяйся с GraphML диаграммой при реализации

ARCHITECTURE CHECKLIST:
- [ ] Структура файлов соответствует docs/DEVELOPER_ARCHITECTURE.md
- [ ] Модули соответствуют узлам в GraphML диаграмме
- [ ] Зависимости соответствуют рёбрам (edges) в GraphML

НАЧИНАЙ С:
1. Изучи всю документацию (особенно SPRINT_1_MVP.md и GraphML)
2. Выполни Задачу 1.1 (инициализация проекта)
3. Выполни Задачу 1.2 (MCP server boilerplate)
4. Сообщи о прогрессе: что сделано, что работает, проблемы

Двигайся итеративно, проверяй часто, сверяйся с архитектурой!
```

