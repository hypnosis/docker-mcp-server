# Setup тестовой Remote среды

## Цель

Создать тестовую среду на remote сервере для проверки работы с SSH профилями.

## Требования

1. Remote сервер с Docker
2. SSH доступ к серверу
3. Тестовый проект с docker-compose.yml

## Шаги setup

### 1. Создать тестовый проект на remote

```bash
# На remote сервере
mkdir -p /var/www/test-db-project
cd /var/www/test-db-project

# Создать docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  test-postgres:
    image: postgres:15-alpine
    container_name: test-db-project-test-postgres-1
    environment:
      POSTGRES_DB: testdb
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U testuser"]
      interval: 5s
      timeout: 5s
      retries: 5

  test-redis:
    image: redis:7-alpine
    container_name: test-db-project-test-redis-1
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
EOF

# Запустить
docker-compose up -d

# Проверить
docker-compose ps
```

### 2. Создать тестовые данные

```bash
# PostgreSQL
docker exec test-db-project-test-postgres-1 psql -U testuser -d testdb -c "
CREATE TABLE test_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  value INTEGER
);

INSERT INTO test_table (name, value) VALUES 
  ('test1', 100),
  ('test2', 200),
  ('remote_marker', 999);  -- УНИКАЛЬНЫЙ МАРКЕР ДЛЯ ПРОВЕРКИ
"

# Redis
docker exec test-db-project-test-redis-1 redis-cli SET test:remote:marker "REMOTE_SERVER"
```

### 3. Создать profiles.json для тестов

```bash
# На локальной машине
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
```

### 4. Установить переменную окружения

```bash
export DOCKER_MCP_PROFILES_FILE=$(pwd)/profiles.test.json
```

## Уникальные маркеры для проверки

### PostgreSQL
```sql
SELECT * FROM test_table WHERE name = 'remote_marker';
-- Должен вернуть: remote_marker | 999
```

### Redis
```
GET test:remote:marker
-- Должен вернуть: "REMOTE_SERVER"
```

## Проверка

После setup можно запустить:

```bash
# Integration тесты
npm test -- tests/integration/remote-profile.test.ts

# Или ручная проверка через MCP
# (через Cursor или другой MCP клиент)
```
