# Результаты тестирования методов на ЛОКАЛЬНОМ Docker (gobunnygo)

**Дата:** 2026-01-08  
**Проект:** gobunnygo (локальный)  
**Контейнер:** gobunnygo-dev (Up, healthy)  
**Проблема:** MCP сервер работает в REMOTE режиме (109.172.39.241)

---

## ВАЖНОЕ ЗАМЕЧАНИЕ

**MCP сервер сейчас настроен на REMOTE Docker через SSH.** Для полноценного тестирования локального Docker нужно:
1. Отключить SSH конфигурацию (убрать DOCKER_SSH_* переменные)
2. Перезапустить MCP сервер
3. Тогда методы будут работать с локальным Docker

---

## РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ

### Методы, которые требуют Docker API (будут работать с REMOTE):

Эти методы будут работать с remote Docker, а не локальным, пока MCP сервер в remote режиме:
- `docker_container_list` - требует Docker API
- `docker_container_start` - требует Docker API  
- `docker_container_stop` - требует Docker API
- `docker_container_restart` - требует Docker API
- `docker_container_logs` - требует Docker API
- `docker_container_stats` - требует Docker API
- `docker_compose_up` - требует Docker API
- `docker_compose_down` - требует Docker API
- `docker_exec` - требует Docker API
- `docker_db_query` - требует Docker API
- `docker_db_backup` - требует Docker API
- `docker_db_restore` - требует Docker API
- `docker_db_status` - требует Docker API
- `docker_healthcheck` - требует Docker API

### Методы, которые могут работать с локальными файлами:

Эти методы могут работать с локальным docker-compose.yml через файловую систему:
- `docker_compose_config` - может читать локальный файл
- `docker_env_list` - может читать локальные .env файлы

---

## ПРОВЕРКА ЛОКАЛЬНОГО ПРОЕКТА

**Найден локальный проект gobunnygo:**
- Путь: `/Users/hypnosis/projects/gobunnygo`
- docker-compose.yml: найден
- Контейнер: `gobunnygo-dev` (Up 9 minutes, healthy)
- Сервис: `gobunnygo-dev`

**Docker-compose структура:**
```yaml
services:
  gobunnygo-dev:
    build: { context: ., dockerfile: Dockerfile }
    image: gobunnygo:dev
    container_name: gobunnygo-dev
    working_dir: /app
    env_file: ./.env.dev
    restart: unless-stopped
    volumes:
      - ./:/app
    healthcheck:
      test: ["CMD","python","-c","import socket; socket.gethostbyname('api.telegram.org')"]
      interval: 30s
      timeout: 5s
      retries: 3

  gobunnygo-prod:
    build: { context: ., dockerfile: Dockerfile }
    image: gobunnygo:prod
    container_name: gobunnygo-prod
    working_dir: /app
    env_file: ./.env.prod
    restart: unless-stopped
    volumes:
      - ./data:/app/data
      - ./media:/app/media
    healthcheck:
      test: ["CMD","python","-c","import socket; socket.gethostbyname('api.telegram.org')"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## ВЫВОДЫ

Для полноценного тестирования методов на локальном Docker необходимо:

1. **Переключить MCP сервер в local режим:**
   - Убрать SSH конфигурацию (переменные DOCKER_SSH_HOST, DOCKER_SSH_USER и т.д.)
   - Перезапустить Cursor (чтобы перезапустился MCP сервер)

2. **После переключения можно будет протестировать:**
   - Все методы контейнеров (list, start, stop, restart, logs, stats)
   - docker_exec
   - docker_compose_up/down
   - Методы БД (если есть БД в проекте)
   - docker_healthcheck

3. **Альтернатива:** Протестировать методы на remote Docker с проектом gobunnygo, если он там есть

---

**Статус:** ⚠️ Тестирование локального Docker требует переключения MCP сервера в local режим
