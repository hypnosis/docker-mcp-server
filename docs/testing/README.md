# 🧪 Testing System - Главная точка входа

> **Единая система тестирования Docker MCP Server**  
> Покрытие: 20 MCP команд | Автоматические + Ручные тесты

---

## ⚡ Быстрый старт (1 команда)

```bash
./pre-commit.sh
```

**Это ВСЁ!** Скрипт делает полный цикл тестирования перед коммитом.

---

## 📋 Структура тестирования

### 1. **Автоматические тесты**

#### E2E тесты (End-to-End)
```bash
# Все тесты (32 теста, ~45s)
npm run test:e2e

# По категориям (быстрая отладка)
npm run test:e2e:container   # Container tools (9 тестов, ~24s)
npm run test:e2e:database    # Database tools (5 тестов, ~2s)
npm run test:e2e:executor    # Executor tool (3 теста, ~1s)
npm run test:e2e:env         # Environment tools (5 тестов, ~1s)
npm run test:e2e:utility     # Utility tools (2 теста, ~1s)
npm run test:e2e:discovery   # Discovery tools (1 тест, ~1s)
npm run test:e2e:compose     # Compose commands (2 теста, ~30s)
npm run test:e2e:errors      # Error handling (3 теста, ~1s)
npm run test:e2e:profile     # Profile parameter (2 теста, ~1s)
```

**Покрытие:** Все 20 MCP команд через 32 E2E теста  
**Файлы:** `tests/e2e/categories/*.test.ts`

#### Unit тесты
```bash
npm run test                  # Все unit тесты
npm run test:watch           # Watch режим
npm run test:coverage        # С покрытием
```

**Файлы:** `tests/unit/**/*.test.ts`

#### Integration тесты
```bash
npm run test:integration     # Remote Docker тесты
```

**Файлы:** `tests/integration/**/*.test.ts`

---

### 2. **Ручные тесты**

Для AI ассистентов и финальной проверки перед релизом.

📖 **[MANUAL_TEST.md](./MANUAL_TEST.md)** — Полный чек-лист ручного тестирования

**Время:** ~15-20 минут  
**Покрытие:** Все 20 команд + 5 критических сценариев

---

### 3. **Мониторинг багов**

📖 **[MCP_BUGS.md](./MCP_BUGS.md)** — Список найденных багов и их статус

---

## 🚀 Полный цикл тестирования

### Шаг 1: Подготовка окружения

```bash
# Запустить тестовое окружение
npm run docker:test:up

# Дождаться готовности (30 секунд)
sleep 30

# Проверить статус
docker-compose -f docker-compose.test.yml ps
```

**Ожидаемый результат:**
- ✅ test-web: Up, healthy
- ✅ test-postgres: Up, healthy
- ✅ test-redis: Up, healthy

---

### Шаг 2: Автоматические тесты

```bash
# Один шаг — всё тестирование
./pre-commit.sh
```

**Что делает:**
1. ✅ Clean & Build проекта
2. ✅ TypeScript проверка типов
3. ✅ Unit тесты
4. ✅ Coverage генерация
5. ✅ Docker окружение проверка
6. ✅ E2E тесты всех 20 MCP команд
7. ✅ Финальные проверки

**Время:** ~5-10 минут  
**Результат:** Готово к коммиту или список ошибок

---

### Шаг 3: Ручное тестирование (опционально)

Для критических изменений или перед релизом:

1. Открыть [MANUAL_TEST.md](./MANUAL_TEST.md)
2. Пройти все тесты по чек-листу
3. Заполнить итоговый отчет

---

### Шаг 4: Проверка багов

Проверить [MCP_BUGS.md](./MCP_BUGS.md) на наличие критических багов.

---

## 📁 Структура файлов

```
docker-mcp-server/
├── docker-compose.test.yml          # Тестовое окружение
├── pre-commit.sh                    # ⭐ Главный скрипт
├── test-data/                       # Тестовые данные
│   ├── postgres/init.sql
│   └── web/
├── tests/
│   ├── e2e/                        # E2E тесты (32 теста)
│   │   ├── categories/             # По категориям
│   │   └── setup.ts
│   ├── unit/                       # Unit тесты
│   └── integration/                # Integration тесты
└── docs/testing/                   # Документация
    ├── README.md                   # ⭐ Ты здесь
    ├── MANUAL_TEST.md              # Ручные тесты
    ├── MCP_BUGS.md                 # Баги
    └── archive/                    # Старые результаты
```

---

## 🎯 Покрытие тестами

### MCP Команды (20 команд)

**Container Tools (9):**
- ✅ docker_container_list
- ✅ docker_container_start
- ✅ docker_container_stop
- ✅ docker_container_restart
- ✅ docker_container_logs
- ✅ docker_container_stats
- ✅ docker_compose_up
- ✅ docker_compose_down
- ✅ docker_resource_list

**Database Tools (4):**
- ✅ docker_db_query
- ✅ docker_db_backup
- ✅ docker_db_restore
- ✅ docker_db_status

**Executor Tool (1):**
- ✅ docker_exec

**Environment Tools (3):**
- ✅ docker_env_list
- ✅ docker_compose_config
- ✅ docker_healthcheck

**Utility Tools (2):**
- ✅ docker_mcp_health
- ✅ docker_profile_info

**Discovery Tools (1):**
- ✅ docker_projects

---

## 🔧 Полезные команды

### Тестирование
```bash
npm run test                  # Unit тесты
npm run test:e2e             # E2E тесты (все)
npm run test:e2e:container   # Быстрая отладка Container
npm run test:all             # Все тесты
npm run test:coverage        # Coverage отчет
```

### Docker окружение
```bash
npm run docker:test:up       # Запустить
npm run docker:test:down     # Остановить
npm run docker:test:logs     # Логи
npm run docker:test:clean    # Очистить (volumes)
```

### Pre-commit
```bash
./pre-commit.sh              # Полный цикл
npm run precommit            # Alias
```

---

## 📊 Метрики

**Статус:** ✅ Все 32 E2E теста проходят  
**Покрытие:** 20/20 MCP команд (100%)  
**Время выполнения:**
- Быстрые категории: ~1-2 секунды
- Container tools: ~24 секунды
- Compose commands: ~30 секунд
- Полный цикл: ~45 секунд

---

## 🚨 Troubleshooting

### Контейнеры не запускаются
```bash
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
sleep 30
```

### PostgreSQL не инициализировался
```bash
docker-compose -f docker-compose.test.yml down -v
docker volume rm docker-mcp-server_postgres_test_data
docker-compose -f docker-compose.test.yml up -d
```

### Тесты падают с timeout
```bash
# Увеличить timeout в tests/e2e/*.test.ts
const DOCKER_TIMEOUT = 60000; // было 30000
```

---

## 📚 Дополнительная документация

- **[MANUAL_TEST.md](./MANUAL_TEST.md)** — Детальный чек-лист ручного тестирования
- **[MCP_BUGS.md](./MCP_BUGS.md)** — Список багов и их статус
- **[../sprints/2026-01-09_TESTING_SYSTEM.md](../sprints/2026-01-09_TESTING_SYSTEM.md)** — История создания системы

---

**Последнее обновление:** 2026-01-09  
**Версия:** 1.2.1
