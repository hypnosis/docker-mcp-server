# Remote Project Discovery

> Автоматический поиск и управление Docker проектами на удаленных серверах

## Обзор

Remote Project Discovery позволяет автоматически находить все Docker проекты на удаленном сервере, читать их `docker-compose.yml` файлы через SSH и получать детальную информацию о статусе каждого проекта.

**Ключевые возможности:**
- ✅ Автоматический поиск всех docker-compose проектов
- ✅ Чтение compose файлов через SSH
- ✅ Определение статусов проектов (running, partial, stopped)
- ✅ Обнаружение проблем (restarting, exited containers)
- ✅ Интеграция с Docker API для matching containers ↔ services

---

## Быстрый Старт

### 1. Настройка SSH профиля

Добавьте `projectsPath` в ваш профиль:

```json
{
  "default": "zaicylab",
  "profiles": {
    "zaicylab": {
      "host": "109.172.39.241",
      "username": "root",
      "port": 22,
      "privateKeyPath": "~/.ssh/id_rsa",
      "projectsPath": "/var/www"
    }
  }
}
```

### 2. Обнаружение проектов

```typescript
// Найти все проекты на сервере
docker_discover_projects()

// Результат:
{
  "projects": [
    {
      "name": "gobunnygo",
      "status": "running",
      "runningContainers": 1,
      "totalServices": 2,
      "issues": []
    },
    {
      "name": "alina",
      "status": "partial",
      "runningContainers": 2,
      "totalServices": 3,
      "issues": ["alina-bot: restarting"]
    }
  ],
  "summary": {
    "total": 5,
    "running": 3,
    "partial": 1,
    "stopped": 1
  }
}
```

### 3. Статус конкретного проекта

```typescript
// Получить детальную информацию
docker_project_status({ project: "gobunnygo" })
```

### 4. Использование project параметра

```typescript
// Теперь можно явно указать проект
docker_container_list({ project: "gobunnygo" })
docker_container_logs("gobunnygo-prod", { project: "gobunnygo", lines: 50 })
docker_exec("gobunnygo-prod", "ls -la", { project: "gobunnygo" })
```

---

## Команды

### docker_discover_projects

Находит все Docker проекты на удаленном сервере. Использует **Fast Mode** по умолчанию для максимальной скорости.

**Архитектура (REST API подход):**
```
GET /projects          → docker_discover_projects()
  → Список ВСЕХ проектов (~2 сек)
  → Использует только Docker labels
  → БЕЗ чтения compose файлов

GET /projects/:name    → docker_project_status({ project: "name" })
  → Детальная информация по ОДНОМУ проекту (~3 сек)
  → Читает compose ТОЛЬКО для указанного проекта
  → БЕЗ поиска через find (использует путь из label)
```

**Параметры:**
- `path` (optional) — Базовая директория для поиска. По умолчанию: из профиля или `/var/www`

**Пример:**
```typescript
// Список всех проектов - ~2 секунды
docker_discover_projects()

// Поиск в конкретной директории
docker_discover_projects({ path: "/opt/docker-projects" })
```

**Возвращает:**
- Список всех найденных проектов (из Docker labels)
- Статус каждого проекта (running/partial/stopped)
- Количество запущенных/остановленных контейнеров
- Путь к проекту (из label `com.docker.compose.project.working_dir`)
- Сводную статистику

---

### docker_project_status

Получает детальную информацию о конкретном проекте. Оптимизирован для работы с одним проектом - читает compose файл только для указанного проекта.

**Параметры:**
- `project` (required) — Имя проекта
- `path` (optional) — Базовая директория для поиска (обычно не требуется, путь берется из Docker label)

**Пример:**
```typescript
docker_project_status({ project: "gobunnygo" })
```

**Как работает:**
1. Фильтрует контейнеры по label `com.docker.compose.project`
2. Берет путь к проекту из label `com.docker.compose.project.working_dir`
3. Читает compose файл ТОЛЬКО этого проекта (без find!)
4. Возвращает детальную информацию

**Возвращает:**
- Полную информацию о проекте
- Список всех сервисов из compose
- Статус каждого контейнера
- Проблемы и рекомендации
- Networks и volumes из compose

---

## Project Parameter

Все команды теперь поддерживают опциональный параметр `project` для явного указания проекта:

```typescript
// Container Management
docker_container_list({ project: "gobunnygo" })
docker_container_start("gobunnygo-prod", { project: "gobunnygo" })
docker_container_logs("gobunnygo-prod", { project: "gobunnygo", lines: 100 })

// Exec
docker_exec("gobunnygo-prod", "npm test", { project: "gobunnygo" })

// Database
docker_db_query("postgres", "SELECT * FROM users;", { project: "gobunnygo" })
```

**Поведение:**
- Если `project` указан → используется явно
- Если не указан → auto-detect (для local) или ошибка (для remote без compose файла локально)

---

## Конфигурация

### Profiles File

Добавьте `projectsPath` в ваш профиль:

```json
{
  "profiles": {
    "production": {
      "host": "prod.example.com",
      "username": "deployer",
      "privateKeyPath": "~/.ssh/id_rsa_prod",
      "projectsPath": "/var/www"
    },
    "staging": {
      "host": "staging.example.com",
      "username": "deployer",
      "privateKeyPath": "~/.ssh/id_rsa_staging",
      "projectsPath": "/opt/apps"
    }
  }
}
```

### Environment Variables

Можно также указать через env переменную (но лучше через profiles):

```bash
DOCKER_REMOTE_PROJECTS_PATH="/var/www"
```

---

## Статусы Проектов

### running
Все сервисы запущены и работают.

```json
{
  "status": "running",
  "runningContainers": 3,
  "totalServices": 3,
  "issues": []
}
```

### partial
Некоторые сервисы не запущены или имеют проблемы.

```json
{
  "status": "partial",
  "runningContainers": 2,
  "totalServices": 3,
  "issues": ["alina-bot: restarting"]
}
```

### stopped
Все сервисы остановлены.

```json
{
  "status": "stopped",
  "runningContainers": 0,
  "totalServices": 3,
  "issues": []
}
```

---

## Обнаружение Проблем

Система автоматически обнаруживает проблемы:

- **Restarting containers** — контейнеры в состоянии перезапуска
- **Exited containers** — контейнеры завершились с ошибкой
- **Missing containers** — сервисы из compose не запущены

**Пример:**
```json
{
  "issues": [
    "alina-bot: restarting",
    "web-service: exited with code 1"
  ]
}
```

---

## Архитектура

### Fast Mode (по умолчанию)

```
┌─────────────────────────────────────────────────────────┐
│  docker_discover_projects() - FAST MODE                 │
│  ~2 секунды                                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. SSH: docker ps -a -q                                 │
│     → Получить ID всех контейнеров                      │
│                                                          │
│  2. SSH: docker inspect (batch)                          │
│     → Все контейнеры одной командой                     │
│     → Извлечь labels:                                   │
│        - com.docker.compose.project                     │
│        - com.docker.compose.service                     │
│        - com.docker.compose.project.working_dir         │
│                                                          │
│  3. Группировка по project label                        │
│     → Определение статуса (running/partial/stopped)     │
│                                                          │
│  ✅ БЕЗ чтения compose файлов!                          │
│  ✅ БЕЗ поиска через find!                              │
│  ✅ Масштабируется на 100+ контейнеров                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  docker_project_status("gobunnygo")                    │
│  ~3 секунды (только 1 проект!)                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. SSH: docker ps -a --filter label=project=gobunnygo │
│     → Только контейнеры этого проекта                   │
│                                                          │
│  2. Извлечь путь из label working_dir                   │
│     → /var/www/gobunnygo                                │
│                                                          │
│  3. SSH: cat /var/www/gobunnygo/docker-compose.yml     │
│     → Читаем compose ТОЛЬКО этого проекта              │
│                                                          │
│  4. Парсим YAML и возвращаем детали                    │
│                                                          │
│  ✅ БЕЗ find!                                           │
│  ✅ БЕЗ чтения всех compose файлов!                    │
└─────────────────────────────────────────────────────────┘
```

### Full Mode (опционально)

```
┌─────────────────────────────────────────────────────────┐
│  docker_discover_projects({ mode: "full" })             │
│  ~14 секунд (для всех проектов)                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Fast Mode +                                            │
│  ├─ SSH: find /var/www -name docker-compose.yml       │
│  ├─ SSH: cat для каждого compose файла                 │
│  └─ Парсинг всех compose файлов                        │
│                                                          │
│  Используется только когда нужна полная информация      │
│  о всех сервисах, networks, volumes                    │
└─────────────────────────────────────────────────────────┘
```

---

## Примеры Использования

### Сценарий 1: Обзор всех проектов

```typescript
// 1. Найти все проекты
const result = await docker_discover_projects();

// 2. Показать сводку
console.log(`Всего проектов: ${result.summary.total}`);
console.log(`Работают: ${result.summary.running}`);
console.log(`С проблемами: ${result.summary.partial}`);

// 3. Проверить проблемные проекты
result.projects
  .filter(p => p.status === 'partial')
  .forEach(project => {
    console.log(`${project.name}: ${project.issues.join(', ')}`);
  });
```

### Сценарий 2: Мониторинг конкретного проекта

```typescript
// 1. Получить статус
const status = await docker_project_status({ project: "gobunnygo" });

// 2. Проверить проблемы
if (status.issues.length > 0) {
  console.log(`⚠️ Проблемы в ${status.name}:`);
  status.issues.forEach(issue => console.log(`  - ${issue}`));
}

// 3. Перезапустить проблемные сервисы
if (status.status === 'partial') {
  // Найти упавшие сервисы и перезапустить
}
```

### Сценарий 3: Работа с конкретным проектом

```typescript
// После discovery, работаем с проектом явно
const projects = await docker_discover_projects();
const project = projects.projects.find(p => p.name === "gobunnygo");

if (project) {
  // Список контейнеров
  await docker_container_list({ project: project.name });
  
  // Логи
  await docker_container_logs("gobunnygo-prod", { 
    project: project.name, 
    lines: 100 
  });
  
  // Выполнить команду
  await docker_exec("gobunnygo-prod", "python manage.py migrate", {
    project: project.name
  });
}
```

---

## Troubleshooting

### Проекты не найдены

**Проблема:** `docker_discover_projects()` возвращает пустой список

**Решения:**
1. Проверьте `projectsPath` в профиле
2. Убедитесь, что SSH доступ работает
3. Проверьте права доступа к директории на remote сервере
4. Убедитесь, что `docker-compose.yml` файлы существуют

```bash
# Проверка на remote сервере
ssh user@server "find /var/www -name docker-compose.yml"
```

### Ошибка чтения compose файла

**Проблема:** `Failed to read remote file`

**Решения:**
1. Проверьте права доступа к файлу
2. Убедитесь, что файл существует
3. Проверьте формат YAML (может быть синтаксическая ошибка)

### Проект не найден по имени

**Проблема:** `docker_project_status({ project: "name" })` возвращает null

**Решения:**
1. Используйте `docker_discover_projects()` чтобы увидеть реальные имена
2. Проверьте, что проект существует на сервере
3. Убедитесь, что имя проекта совпадает точно (case-sensitive)

---

## Производительность

### Fast Mode (по умолчанию)
- **Discovery:** ~2 секунды (независимо от количества проектов!)
- **Project Status:** ~2-3 секунды (только 1 проект)
- **Масштабируемость:** 100 контейнеров = та же скорость

### Full Mode
- **Discovery:** ~14 секунд (читает все compose файлы)
- **Project Status:** ~2-3 секунды (как и fast mode)

**Сравнение:**
```
Fast Mode:  docker_discover_projects()           → 2 сек
Full Mode:  docker_discover_projects({mode:"full"}) → 14 сек
Status:     docker_project_status("name")        → 3 сек
```

**Рекомендации:**
- ✅ Используйте Fast Mode для списка проектов (по умолчанию)
- ✅ Используйте `docker_project_status()` для деталей конкретного проекта
- ✅ Full Mode только если нужна полная информация о всех проектах сразу
- ✅ Не вызывайте discovery слишком часто (кешируйте результаты)

---

## Безопасность

- ✅ SSH ключи вместо паролей
- ✅ Path validation предотвращает directory traversal
- ✅ Только чтение файлов (не запись)
- ✅ Логирование без чувствительных данных

---

## Ограничения

1. **Только Remote:** Discovery работает только с remote Docker (требует SSH)
2. **Требует SSH доступ:** Нужны права на чтение файлов и выполнение команд
3. **Производительность:** SSH добавляет латентность
4. **Compose файлы:** Требуются docker-compose.yml файлы на сервере

---

## Связанные Документы

- [Remote Docker Guide](./REMOTE_DOCKER.md) — Основное руководство по remote Docker
- [API Reference](./API_REFERENCE.md) — Полная документация команд
- [Examples](./EXAMPLES.md) — Примеры использования

---

**Обновлено:** 2026-01-09  
**Версия:** 1.1.0
