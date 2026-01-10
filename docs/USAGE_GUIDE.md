# Руководство по использованию Docker MCP Server

**Версия:** 1.3.0  
**Дата:** 2026-01-10

## Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Работа с тулзами](#работа-с-тулзами)
3. [Локальный режим](#локальный-режим)
4. [Remote режим (SSH)](#remote-режим-ssh)
5. [Примеры использования](#примеры-использования)
6. [Частые вопросы](#частые-вопросы)

---

## Быстрый старт

### Установка

```bash
npm install -g @hypnosis/docker-mcp-server
```

### Конфигурация для Cursor

**Минимальная конфигурация (локальный Docker):**
```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"]
    }
  }
}
```

**С remote профилями:**
```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"],
      "env": {
        "DOCKER_PROFILES_FILE": "~/.cursor/docker-profiles.json"
      }
    }
  }
}
```

Создайте файл `~/.cursor/docker-profiles.json`:
```json
{
  "default": "local",
  "profiles": {
    "local": {
      "mode": "local"
    },
    "production": {
      "host": "prod.example.com",
      "username": "deployer",
      "port": 22,
      "privateKeyPath": "~/.ssh/id_rsa",
      "projectsPath": "/var/www"
    }
  }
}
```

---

## Работа с тулзами

### Все 20 доступных тулзов

#### Контейнеры (9 тулзов)
- `docker_container_list` - список всех контейнеров
- `docker_container_start` - запуск контейнера
- `docker_container_stop` - остановка контейнера
- `docker_container_restart` - перезапуск контейнера
- `docker_container_logs` - просмотр логов
- `docker_container_stats` - статистика использования ресурсов
- `docker_compose_up` - запуск всего стека
- `docker_compose_down` - остановка всего стека
- `docker_resource_list` - список образов/томов/сетей

#### Базы данных (4 тулза)
- `docker_db_query` - выполнение SQL запросов
- `docker_db_status` - статус и статистика БД
- `docker_db_backup` - создание бэкапа
- `docker_db_restore` - восстановление из бэкапа

#### Окружение и конфигурация (3 тулза)
- `docker_env_list` - список переменных окружения
- `docker_compose_config` - парсированный config compose
- `docker_healthcheck` - проверка здоровья сервисов

#### Универсальные (4 тулза)
- `docker_exec` - выполнение команд в контейнере
- `docker_projects` - список всех проектов
- `docker_profile_info` - информация о профилях
- `docker_mcp_health` - диагностика MCP сервера

---

## Локальный режим

### Базовое использование (без profile)

Все тулзы работают с локальным Docker по умолчанию:

```typescript
// Список всех проектов
docker_projects()

// Список контейнеров конкретного проекта
docker_container_list({project: "my-app"})

// Логи сервиса
docker_container_logs({service: "web", lines: 50})

// Статус БД
docker_db_status({service: "postgres"})

// Запрос к БД
docker_db_query({service: "postgres", query: "SELECT version();"})
```

### Особенности локального режима

- ✅ Автоматическое обнаружение `docker-compose.yml` в текущей директории
- ✅ Рекурсивный поиск compose файлов в родительских директориях
- ✅ Использование workspace root от MCP клиента (Cursor/Claude)
- ✅ Fallback на `process.cwd()` если workspace root не доступен

---

## Remote режим (SSH)

### Настройка профилей

Профили настраиваются в файле, указанном в `DOCKER_PROFILES_FILE`:

```json
{
  "default": "local",
  "profiles": {
    "production": {
      "host": "prod.example.com",
      "username": "deployer",
      "port": 22,
      "privateKeyPath": "~/.ssh/id_rsa",
      "projectsPath": "/var/www"
    },
    "staging": {
      "host": "staging.example.com",
      "username": "deployer",
      "port": 2222,
      "privateKeyPath": "~/.ssh/id_rsa_staging",
      "projectsPath": "/opt/apps"
    }
  }
}
```

### Использование с profile

Все тулзы поддерживают параметр `profile` для работы с remote серверами:

```typescript
// Список проектов на remote сервере
docker_projects({profile: "production"})

// Список контейнеров remote проекта
docker_container_list({profile: "production", project: "my-app"})

// Логи remote контейнера
docker_container_logs({
  service: "web",
  profile: "production",
  project: "my-app",
  lines: 100
})

// Запрос к remote БД
docker_db_query({
  service: "postgres",
  profile: "production",
  project: "my-app",
  query: "SELECT * FROM users LIMIT 5;"
})

// Статус remote БД
docker_db_status({
  service: "postgres",
  profile: "production",
  project: "my-app"
})
```

### Особенности remote режима

- ✅ Автоматическое создание SSH туннеля для Docker API
- ✅ Healthcheck SSH туннеля с автопереподключением
- ✅ Чтение `docker-compose.yml` файлов через SSH
- ✅ Поддержка кастомного `projectsPath` в профиле
- ✅ Использование SSH ключей для аутентификации

### Требования для remote режима

1. **SSH доступ к серверу:**
   - Публичный ключ должен быть добавлен в `~/.ssh/authorized_keys`
   - Или использование SSH agent
   - Или указание пути к приватному ключу в профиле

2. **Docker на remote сервере:**
   - Docker должен быть установлен и запущен
   - Docker socket доступен (`/var/run/docker.sock`)
   - Пользователь имеет права для работы с Docker

3. **Структура проектов:**
   - Проекты должны быть в директории, указанной в `projectsPath` (по умолчанию `/var/www`)
   - Каждый проект должен иметь `docker-compose.yml` в корне

---

## Примеры использования

### Разработка локально

```typescript
// 1. Запуск проекта
docker_compose_up({build: true, detach: true})

// 2. Проверка статуса
docker_healthcheck()

// 3. Просмотр логов
docker_container_logs({service: "web", follow: true, lines: 50})

// 4. Выполнение миграций
docker_exec({
  service: "web",
  command: "python manage.py migrate"
})

// 5. Запуск тестов
docker_exec({
  service: "web",
  command: "npm test"
})

// 6. Проверка БД
docker_db_status({service: "postgres"})
docker_db_query({
  service: "postgres",
  query: "SELECT COUNT(*) FROM users;"
})
```

### Развертывание на production

```typescript
// 1. Проверка статуса на production
docker_healthcheck({profile: "production", project: "my-app"})

// 2. Просмотр логов production
docker_container_logs({
  service: "web",
  profile: "production",
  project: "my-app",
  lines: 100
})

// 3. Создание бэкапа перед деплоем
docker_db_backup({
  service: "postgres",
  profile: "production",
  project: "my-app",
  compress: true
})

// 4. Перезапуск сервиса после деплоя
docker_container_restart({
  service: "web",
  profile: "production",
  project: "my-app"
})

// 5. Проверка что все работает
docker_healthcheck({profile: "production", project: "my-app"})
```

### Отладка проблем

```typescript
// 1. Проверка всех проектов
docker_projects({profile: "production"})

// 2. Список контейнеров проблемного проекта
docker_container_list({
  profile: "production",
  project: "my-app"
})

// 3. Статистика ресурсов
docker_container_stats({
  service: "web",
  profile: "production",
  project: "my-app"
})

// 4. Переменные окружения
docker_env_list({
  profile: "production",
  project: "my-app",
  service: "web"
})

// 5. Проверка конфигурации
docker_compose_config({
  profile: "production",
  project: "my-app"
})
```

---

## Частые вопросы

### Как переключиться между локальным и remote режимом?

Просто используйте или не используйте параметр `profile`:

```typescript
// Локальный режим
docker_container_list({project: "my-app"})

// Remote режим
docker_container_list({profile: "production", project: "my-app"})
```

### Какой профиль используется по умолчанию?

Если не указан `profile`, используется локальный Docker.  
Если указан `profile`, который не найден, будет ошибка (без fallback на локальный для безопасности).

### Как узнать доступные профили?

```typescript
docker_profile_info()
```

Вернет список всех доступных профилей и текущий default.

### Почему не работает remote режим?

1. Проверьте что профиль существует: `docker_profile_info()`
2. Проверьте SSH доступ: `ssh username@host`
3. Проверьте что Docker запущен на remote сервере
4. Проверьте логи MCP сервера (stderr)

### Как настроить projectsPath для remote проектов?

Укажите в профиле:

```json
{
  "production": {
    "host": "prod.example.com",
    "username": "deployer",
    "projectsPath": "/opt/apps"  // Кастомный путь
  }
}
```

По умолчанию используется `/var/www`.

### Безопасно ли использовать remote режим?

✅ Да, при правильной настройке:
- Используется SSH туннель для защищенного подключения
- Приватные ключи не передаются, используются локальные SSH ключи
- Docker API доступен только через SSH туннель

⚠️ Важно:
- Храните приватные ключи в безопасности
- Используйте разные ключи для разных серверов
- Не коммитьте файлы с профилями в Git

---

## Поддержка баз данных

### PostgreSQL

✅ Полная поддержка:
- Запросы через `psql`
- Бэкапы через `pg_dump`
- Восстановление через `pg_restore`
- Статус с реальными метриками

Поддерживаемые образы:
- `postgres:*`
- `ankane/pgvector:latest`
- `timescale/timescaledb:*`
- `postgis/postgis:*`

### Redis

✅ Полная поддержка:
- Команды через `redis-cli`
- Бэкапы через `BGSAVE`
- Восстановление из RDB файлов
- Статус с метриками

### SQLite

✅ Полная поддержка:
- Запросы через `sqlite3`
- Бэкапы через `.backup`
- Восстановление

---

## Диагностика

### Проверка здоровья MCP сервера

```typescript
docker_mcp_health()
```

Показывает:
- Статус Docker подключения
- Статус SSH (если настроено)
- Статус обнаружения проектов
- Зарегистрированные адаптеры
- Использование памяти

### Включение debug логов

Установите переменную окружения:

```bash
export LOG_LEVEL=debug
```

Или в конфигурации Cursor:

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

---

## Дополнительные ресурсы

- [API Reference](API_REFERENCE.md) - полная документация всех тулзов
- [Remote Docker Guide](REMOTE_DOCKER.md) - подробное руководство по remote режиму
- [Examples](EXAMPLES.md) - больше примеров использования
- [Troubleshooting](TROUBLESHOOTING.md) - решение проблем

---

**Версия документации:** 1.3.0  
**Последнее обновление:** 2026-01-10
