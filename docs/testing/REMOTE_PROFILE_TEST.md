# 🌐 Remote Profile Testing Guide

> **Тестирование SSH remote профилей с явными ошибками и DI**

## Цель

Убедиться, что при указании `profile` команды **ТОЧНО** идут на remote сервер, а не на локальный. Если profile не найден - должна быть **ЯВНАЯ ОШИБКА**.

---

## 🎯 Критерии успеха

### ✅ Должно работать:
1. **Local без profile** → работает на локальном Docker
2. **Local с profile="local"** → работает на локальном Docker  
3. **Remote с валидным profile** → работает на remote сервере через SSH

### ❌ Должно выдавать ОШИБКУ:
1. **Profile не найден** → ЯВНАЯ ошибка `PROFILE ERROR` с объяснением
2. **НЕТ fallback** → Если profile указан, но не найден, НЕ должно работать локально!

---

## 📋 Подготовка

### Шаг 1: Настроить profiles.json

```bash
# Создать profiles.json
cat > profiles.test.json << 'EOF'
{
  "profiles": {
    "test-remote": {
      "mode": "remote",
      "host": "YOUR_REMOTE_HOST",
      "port": 22,
      "user": "YOUR_USER",
      "privateKeyPath": "~/.ssh/id_rsa",
      "projectsPath": "/var/www"
    }
  }
}
EOF

# Экспортировать переменную
export DOCKER_MCP_PROFILES_FILE=$(pwd)/profiles.test.json
```

### Шаг 2: Подготовить тестовую среду на remote

```bash
# На remote сервере
mkdir -p /var/www/test-remote-db
cd /var/www/test-remote-db

# Создать docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  test-postgres-remote:
    image: postgres:15-alpine
    container_name: test-remote-db-test-postgres-remote-1
    environment:
      POSTGRES_DB: testdb_remote
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
    ports:
      - "5432:5432"

  test-redis-remote:
    image: redis:7-alpine
    container_name: test-remote-db-test-redis-remote-1
    ports:
      - "6379:6379"
EOF

# Запустить
docker-compose up -d

# Создать тестовые данные с МАРКЕРОМ
docker exec test-remote-db-test-postgres-remote-1 psql -U testuser -d testdb_remote -c "
CREATE TABLE test_remote (
  id SERIAL PRIMARY KEY,
  marker VARCHAR(100)
);

INSERT INTO test_remote (marker) VALUES ('REMOTE_SERVER_MARKER');
"

# Redis маркер
docker exec test-remote-db-test-redis-remote-1 redis-cli SET remote:marker "REMOTE_SERVER"
```

---

## 🧪 Тесты через MCP

### Тест 1: ❌ ЯВНАЯ ОШИБКА - Profile не найден

```
Команда: docker_db_query({
  service: "postgres",
  query: "SELECT 1",
  profile: "non-existent-profile"
})
```

**Ожидаемый результат:**
```
❌ PROFILE ERROR: Profile "non-existent-profile" was specified but could not be resolved.

Possible causes:
  1. Profile "non-existent-profile" not found in profiles.json
  2. DOCKER_MCP_PROFILES_FILE environment variable not set
  3. profiles.json file is invalid or missing

⚠️  NO FALLBACK TO LOCAL: This is intentional to prevent accidental local operations.
    If you want to use local Docker, omit the "profile" parameter.
```

**✅ КРИТИЧНО:** Должна быть ОШИБКА, а НЕ fallback на local!

---

### Тест 2: ✅ Local без profile

```
Команда: docker_db_query({
  service: "postgres",
  query: "SELECT marker FROM test_remote LIMIT 1"
})
```

**Ожидаемый результат:**
- ✅ Запрос выполнен на **ЛОКАЛЬНОМ** Docker
- ✅ Если таблицы нет локально - нормальная ошибка (не PROFILE ERROR)

---

### Тест 3: ✅ Remote с валидным profile

```
Команда: docker_db_query({
  service: "test-postgres-remote",
  query: "SELECT marker FROM test_remote LIMIT 1",
  profile: "test-remote"
})
```

**Ожидаемый результат:**
- ✅ Запрос выполнен на **REMOTE** сервере
- ✅ Возвращено: `REMOTE_SERVER_MARKER` (не локальное значение!)

**Проверка:**
- Если видишь `REMOTE_SERVER_MARKER` → ✅ Работает на remote!
- Если видишь локальные данные → ❌ Работает на local (БАГ!)

---

### Тест 4: ✅ Local с profile="local" (если настроен)

```
Команда: docker_db_query({
  service: "postgres",
  query: "SELECT 1",
  profile: "local"
})
```

**Ожидаемый результат:**
- ✅ Запрос выполнен на **ЛОКАЛЬНОМ** Docker
- ✅ Нет ошибки

---

### Тест 5: 🔍 Redis - Проверка remote

```
Команда: docker_db_query({
  service: "test-redis-remote",
  query: "GET remote:marker",
  profile: "test-remote"
})
```

**Ожидаемый результат:**
- ✅ Возвращено: `"REMOTE_SERVER"` (маркер с remote)
- ✅ НЕ `null` или локальное значение

---

### Тест 6: 🔍 Container List - Проверка remote

```
Команда: docker_container_list({
  profile: "test-remote"
})
```

**Ожидаемый результат:**
- ✅ Видны контейнеры с remote сервера:
  - `test-remote-db-test-postgres-remote-1`
  - `test-remote-db-test-redis-remote-1`
- ✅ НЕ видны локальные контейнеры (`test-web`, `test-postgres`)

---

## 🎯 Критическая проверка: Уникальный маркер

### PostgreSQL

Создай на remote сервере уникальную запись:
```sql
INSERT INTO test_remote (marker) VALUES ('UNIQUE_REMOTE_MARKER_2026');
```

Затем выполни через MCP:
```
docker_db_query({
  service: "test-postgres-remote",
  query: "SELECT marker FROM test_remote WHERE marker LIKE '%UNIQUE_REMOTE_MARKER%'",
  profile: "test-remote"
})
```

**✅ Если видишь `UNIQUE_REMOTE_MARKER_2026`** → Работает на remote!  
**❌ Если НЕ видишь или ошибка** → Работает на local (БАГ!)

---

### Redis

```bash
# На remote сервере
docker exec test-remote-db-test-redis-remote-1 redis-cli SET unique:remote:2026 "YES_THIS_IS_REMOTE"
```

Затем через MCP:
```
docker_db_query({
  service: "test-redis-remote",
  query: "GET unique:remote:2026",
  profile: "test-remote"
})
```

**✅ Если видишь `YES_THIS_IS_REMOTE`** → Работает на remote!  
**❌ Если `null` или ошибка** → Работает на local (БАГ!)

---

## 📝 Чеклист тестирования

### Автоматические тесты (уже есть)
- [x] Unit тесты с моками (`tests/unit/database-tools-profile.test.ts`)
- [x] E2E тесты для local профиля (`tests/e2e/categories/profile-parameter.test.ts`)
- [x] E2E тесты для явных ошибок

### Ручное тестирование (выполнить)
- [ ] ❌ Тест 1: Явная ошибка при неверном profile
- [ ] ✅ Тест 2: Local без profile
- [ ] ✅ Тест 3: Remote с валидным profile (PostgreSQL)
- [ ] ✅ Тест 4: Local с profile="local"
- [ ] ✅ Тест 5: Remote Redis
- [ ] ✅ Тест 6: Remote Container List
- [ ] 🔍 Критическая проверка: Уникальный маркер (PostgreSQL)
- [ ] 🔍 Критическая проверка: Уникальный маркер (Redis)

---

## 🚨 Что делать если не работает

### Проблема: Profile не найден, но работает локально

**Симптом:** Указал `profile: "test-remote"`, но команда выполнилась на локальном Docker.

**Решение:**
1. Проверь `validateProfile()` в `DatabaseTools` - должна выбрасывать ошибку
2. Проверь `resolveProfile()` - должен возвращать `null` для несуществующего profile
3. Проверь логи - должна быть ошибка `PROFILE ERROR`

### Проблема: Profile найден, но работает на local

**Симптом:** Указал `profile: "test-remote"`, profile найден, но команда идет на local.

**Решение:**
1. Проверь что `ContainerManager` создается с правильным `sshConfig`
2. Проверь что адаптер создается через `createAdapter()` с `sshConfig`
3. Проверь логи - должно быть `✅ Profile "test-remote" resolved successfully`

---

## ✅ Итоговый отчет

После тестирования заполни:

**Дата:** _________________  
**Версия:** _________________  
**Remote сервер:** _________________

**Результаты:**
- [x] Явные ошибки работают
- [ ] Remote PostgreSQL работает
- [ ] Remote Redis работает
- [ ] Remote Container List работает
- [ ] Уникальные маркеры подтверждают remote

**Проблемы:**
_________________________________
_________________________________

**Готово к продакшену:** ✅ ДА / ❌ НЕТ

---

**Последнее обновление:** 2026-01-10  
**Версия:** 1.2.1
