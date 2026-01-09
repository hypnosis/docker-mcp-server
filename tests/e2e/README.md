# E2E Tests - Изолированный запуск

## ✅ Статус
**Все 32 теста проходят успешно!**

## Быстрая отладка (по 1 категории)

### Быстрые тесты (~1-2 секунды)
```bash
npm run test:e2e:executor   # 3 теста - Executor tool
npm run test:e2e:env        # 5 тестов - Environment tools  
npm run test:e2e:utility    # 2 теста - Utility tools
npm run test:e2e:discovery  # 1 тест - Discovery tools
npm run test:e2e:errors     # 3 теста - Error handling
npm run test:e2e:profile    # 2 теста - Profile parameter
```

### Средние тесты (~2-5 секунд)
```bash
npm run test:e2e:database   # 5 тестов - Database tools
```

### Долгие тесты (~20-30 секунд)
```bash
npm run test:e2e:container  # 9 тестов - Container tools (stop/start/restart)
npm run test:e2e:compose    # 2 теста - Compose up/down (~30s)
```

## Все тесты сразу
```bash
npm run test:e2e            # Все 32 теста (~45s)
```

## Запуск конкретного теста
```bash
# По имени теста
npm run test:e2e:container -- -t "docker_container_list"

# По файлу
npx vitest run tests/e2e/categories/container-tools.test.ts -t "docker_container_stop"
```

## Watch режим для отладки
```bash
# Все тесты в watch
npm run test:e2e:watch

# Конкретная категория в watch
npx vitest tests/e2e/categories/executor-tool.test.ts
```

## Структура файлов
```
tests/e2e/
├── setup.ts                    # Общий setup (регистрация адаптеров)
├── mcp-tools.test.ts           # Главный файл (импортирует все категории)
└── categories/
    ├── container-tools.test.ts  # Container tools (9 тестов)
    ├── database-tools.test.ts   # Database tools (5 тестов)
    ├── executor-tool.test.ts    # Executor tool (3 теста)
    ├── env-tools.test.ts        # Environment tools (5 тестов)
    ├── utility-tools.test.ts    # Utility tools (2 теста)
    ├── discovery-tools.test.ts  # Discovery tools (1 тест)
    ├── compose-tools.test.ts    # Compose commands (2 теста)
    ├── error-handling.test.ts   # Error handling (3 теста)
    └── profile-parameter.test.ts # Profile parameter (2 теста)
```

## Примеры использования

### Отладка конкретной команды
```bash
# Тестируешь docker_exec? Запусти только executor тесты
npm run test:e2e:executor

# Тестируешь database? Запусти только database тесты
npm run test:e2e:database
```

### Быстрая проверка перед коммитом
```bash
# Только быстрые тесты (не ждать 45 секунд)
npm run test:e2e:executor
npm run test:e2e:env
npm run test:e2e:utility
npm run test:e2e:discovery
npm run test:e2e:errors
npm run test:e2e:profile
npm run test:e2e:database
```

### Полная проверка
```bash
npm run test:e2e            # Все 32 теста
```
