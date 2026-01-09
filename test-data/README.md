# Test Data

Эта папка содержит тестовые данные для E2E тестирования Docker MCP Server.

## Структура

```
test-data/
├── postgres/
│   └── init.sql              # SQL скрипт инициализации PostgreSQL
├── web/
│   ├── package.json          # Node.js проект для тестирования
│   └── index.js              # Простое приложение
└── redis/                    # (пусто, Redis не требует инициализации)
```

## PostgreSQL Test Data

**Файл:** `postgres/init.sql`

**Содержит:**
- Таблица `users` с 3 тестовыми пользователями
- Таблица `posts` с 4 тестовыми постами
- Индексы для производительности
- Функция `count_user_posts()` для тестирования stored procedures

**Автоматическая загрузка:**
При запуске `docker-compose -f docker-compose.test.yml up -d` PostgreSQL автоматически выполняет `init.sql` при первом запуске.

**Тестовые данные:**
- testuser1 (test1@example.com) — 2 поста
- testuser2 (test2@example.com) — 1 пост
- testuser3 (test3@example.com) — 1 пост

## Web Test Application

**Файлы:** `web/package.json`, `web/index.js`

**Содержит:**
- Простое Node.js приложение
- npm скрипты для тестирования (`npm test`)
- Выводит информацию об окружении

**Использование в тестах:**
- Тестирование `docker_exec` команды
- Проверка переменных окружения
- Тестирование npm команд в контейнере

## Redis

Redis не требует инициализации данных. Тестовые данные создаются динамически в E2E тестах через `SET`/`GET` команды.

## Обновление тестовых данных

### PostgreSQL

Отредактируй `postgres/init.sql` и пересоздай контейнер:

```bash
npm run docker:test:clean
npm run docker:test:up
```

### Web Application

Отредактируй `web/package.json` или `web/index.js` и перезапусти контейнер:

```bash
docker-compose -f docker-compose.test.yml restart web
```

## Очистка данных

Для полной очистки всех данных (включая volumes):

```bash
npm run docker:test:clean
```

Это удалит:
- Все контейнеры тестового окружения
- Все volumes (postgres_test_data, redis_test_data)
- Сеть test-network

## Примечания

- Данные в volumes сохраняются между перезапусками контейнеров
- `init.sql` выполняется только при первом создании volume
- Для переинициализации БД удали volume командой `npm run docker:test:clean`
