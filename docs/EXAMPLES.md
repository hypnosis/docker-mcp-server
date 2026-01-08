# Usage Examples

> Real-world scenarios and workflows with Docker MCP Server

## Table of Contents

- [Web Development](#web-development)
- [Backend API Development](#backend-api-development)
- [Telegram Bot Development](#telegram-bot-development)
- [Data Science Projects](#data-science-projects)
- [Microservices](#microservices)
- [Common Workflows](#common-workflows)

---

## Web Development

### Next.js + PostgreSQL + Redis

**Project Structure:**
```yaml
# docker-compose.yml
services:
  web:
    build: .
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
  
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: example_password
  
  redis:
    image: redis:7-alpine
```

**Daily Development Workflow:**

```typescript
// Morning: Start the project
docker_compose_up({build: true})

// Check everything is healthy
docker_healthcheck()
// ✅ web: healthy
// ✅ postgres: healthy  
// ✅ redis: healthy

// View logs during development
docker_container_logs("web", {follow: true, lines: 50})

// Run tests after changes
docker_exec("web", "npm test")

// Check Redis cache
docker_db_query("redis", "KEYS *")
docker_db_query("redis", "GET user:session:123")

// Database queries
docker_db_query("postgres", "SELECT COUNT(*) FROM users;")
docker_db_query("postgres", "\\dt")  // List tables

// Restart after config changes
docker_container_restart("web")

// Evening: Stop everything
docker_compose_down()
```

**Deployment Preparation:**

```typescript
// Create database backup before deploy
docker_db_backup("postgres", "./backups/pre-deploy-2024-12-31.sql")

// Run production build
docker_exec("web", "npm run build")

// Run integration tests
docker_exec("web", "npm run test:integration")

// Check for any errors in logs
docker_container_logs("web", {lines: 100})
```

---

## Backend API Development

### Django + PostgreSQL + Celery + Redis

**Project Structure:**
```yaml
# docker-compose.yml
services:
  api:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    ports: ["8000:8000"]
  
  postgres:
    image: postgres:15-alpine
  
  redis:
    image: redis:7-alpine
  
  celery:
    build: .
    command: celery -A myapp worker -l info
```

**Development Workflow:**

```typescript
// Start all services
docker_compose_up({build: true})

// Run database migrations
docker_exec("api", "python manage.py migrate")

// Create superuser
docker_exec("api", "python manage.py createsuperuser --noinput")

// Load fixtures
docker_exec("api", "python manage.py loaddata initial_data.json")

// Run tests
docker_exec("api", "python manage.py test")
docker_exec("api", "pytest tests/ -v")

// Check Celery worker logs
docker_container_logs("celery", {follow: true})

// Django shell for debugging
docker_exec("api", "python manage.py shell", {interactive: true})

// Database queries
docker_db_query("postgres", "SELECT * FROM auth_user LIMIT 5;")
docker_db_query("postgres", "SELECT COUNT(*) FROM django_session;")

// Check Redis queue
docker_db_query("redis", "LLEN celery")
docker_db_query("redis", "KEYS celery*")

// Restart API after code changes
docker_container_restart("api")
```

**Database Management:**

```typescript
// Create migration
docker_exec("api", "python manage.py makemigrations")

// Apply migrations
docker_exec("api", "python manage.py migrate")

// Show migration status
docker_exec("api", "python manage.py showmigrations")

// Rollback migration
docker_exec("api", "python manage.py migrate myapp 0003")

// Backup database
docker_db_backup("postgres", "./backups/db-$(date +%Y%m%d).sql")

// Restore from backup
docker_db_restore("postgres", "./backups/db-20241231.sql")

// Check database status
docker_db_status("postgres")
```

---

## Telegram Bot Development

### Python Bot + PostgreSQL + Alembic

**Project Structure:**
```yaml
# docker-compose.yml
services:
  bot:
    build: .
    command: python -m src.bot.bot
    depends_on:
      postgres:
        condition: service_healthy
  
  postgres:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bot"]
      interval: 10s
```

**Development Workflow:**

```typescript
// Start the bot
docker_compose_up()

// Check bot is running
docker_healthcheck()
// ✅ bot: healthy
// ✅ postgres: healthy

// View bot logs in real-time
docker_container_logs("bot", {follow: true, timestamps: true})

// Run database migrations
docker_exec("bot", "alembic upgrade head")

// Check migration history
docker_exec("bot", "alembic history")

// Run tests
docker_exec("bot", "pytest tests/ -v")
docker_exec("bot", "pytest tests/combat/ -v")

// Run specific test
docker_exec("bot", "pytest tests/bot/test_handlers.py::test_start_command")

// Database queries
docker_db_query("postgres", "SELECT * FROM users ORDER BY created_at DESC LIMIT 10;")
docker_db_query("postgres", "SELECT COUNT(*) FROM game_sessions WHERE status='active';")

// Check tables
docker_db_query("postgres", "\\dt")
docker_db_query("postgres", "\\d users")  // Describe table

// Restart bot after code changes
docker_container_restart("bot")

// Create database backup
docker_db_backup("postgres", "./backups/bot-db-backup.sql")
```

**Debugging:**

```typescript
// Check Python version and packages
docker_exec("bot", "python --version")
docker_exec("bot", "pip list")

// Check environment variables
docker_env_list({service: "bot"})

// Run Python REPL
docker_exec("bot", "python", {interactive: true})

// Check logs for errors
docker_container_logs("bot", {lines: 100})

// Check database connections
docker_db_query("postgres", 
  "SELECT count(*) FROM pg_stat_activity WHERE datname='dungeon_mayhem';"
)
```

---

## Data Science Projects

### Jupyter + PostgreSQL + Redis

**Project Structure:**
```yaml
# docker-compose.yml
services:
  jupyter:
    image: jupyter/scipy-notebook
    ports: ["8888:8888"]
  
  postgres:
    image: postgres:15-alpine
  
  redis:
    image: redis:7-alpine
```

**Workflow:**

```typescript
// Start services
docker_compose_up()

// Get Jupyter token
docker_container_logs("jupyter", {lines: 20})
// → http://127.0.0.1:8888/?token=example_token_123...

// Load data into database
docker_exec("postgres", 
  "psql -U postgres -c \"COPY users FROM '/data/users.csv' CSV HEADER;\""
)

// Query data
docker_db_query("postgres", 
  "SELECT COUNT(*), AVG(age) FROM users GROUP BY country;"
)

// Cache results in Redis
docker_db_query("redis", "SET analysis:users:count 10000")
docker_db_query("redis", "EXPIRE analysis:users:count 3600")

// Check cache
docker_db_query("redis", "GET analysis:users:count")

// Backup analysis results
docker_db_backup("postgres", "./results/analysis-2024-12-31.sql")
```

---

## Microservices

### Multiple Services + Shared Database

**Project Structure:**
```yaml
# docker-compose.yml
services:
  api-gateway:
    build: ./gateway
    ports: ["8000:8000"]
  
  user-service:
    build: ./services/users
  
  order-service:
    build: ./services/orders
  
  postgres:
    image: postgres:15-alpine
  
  redis:
    image: redis:7-alpine
```

**Workflow:**

```typescript
// Start all services
docker_compose_up({build: true})

// Check health of all services
docker_healthcheck()

// View logs from specific service
docker_container_logs("user-service", {follow: true})

// View logs from all services (use terminal)
// docker-compose logs -f

// Run tests for each service
docker_exec("user-service", "npm test")
docker_exec("order-service", "npm test")

// Database queries
docker_db_query("postgres", "SELECT * FROM users LIMIT 5;")
docker_db_query("postgres", "SELECT * FROM orders WHERE status='pending';")

// Check Redis cache
docker_db_query("redis", "KEYS user:*")
docker_db_query("redis", "KEYS order:*")

// Restart specific service
docker_container_restart("user-service")

// Scale service
docker_compose_up({scale: {user-service: 3}})
```

---

## CLI Interface Usage

### Direct Command Execution

The Docker MCP Server includes a CLI interface for direct command execution outside of MCP clients:

```bash
# List containers
docker-mcp-server-cli ps

# Start services
docker-mcp-server-cli up

# Execute command in container
docker-mcp-server-cli exec python "python --version"

# View logs
docker-mcp-server-cli logs redis --lines 10

# Restart container
docker-mcp-server-cli container-restart python

# Environment variables
docker-mcp-server-cli env-list

# Health check
docker-mcp-server-cli healthcheck
```

### Container Discovery Strategy

The CLI uses the same three-level fallback as the MCP server:

1. **Docker Compose Labels** (Priority) - Direct Docker API call using `com.docker.compose.project` label
2. **docker-compose ps CLI** (Fallback 1) - For older docker-compose versions
3. **Name-based filter** (Fallback 2) - Filter by project name in container names

This ensures reliable container discovery across different Docker Compose versions and configurations.

---

## Common Workflows

### Morning Startup

```typescript
// 1. Start project
docker_compose_up()

// 2. Check everything is healthy
docker_healthcheck()

// 3. Run migrations if needed
docker_exec("web", "npm run migrate")
// or
docker_exec("api", "python manage.py migrate")
// or
docker_exec("bot", "alembic upgrade head")

// 4. Check logs for any startup errors
docker_container_logs("web", {lines: 50})

// 5. Ready to code! 🚀
```

### After Code Changes

```typescript
// 1. Restart service
docker_container_restart("web")

// 2. Check logs
docker_container_logs("web", {follow: true, lines: 20})

// 3. Run tests
docker_exec("web", "npm test")

// 4. If all good, commit changes ✅
```

### Before Committing

```typescript
// 1. Run all tests
docker_exec("web", "npm test")

// 2. Run linter
docker_exec("web", "npm run lint")

// 3. Check for errors in logs
docker_container_logs("web", {lines: 100})

// 4. If all pass, commit! ✅
```

### Before Deployment

```typescript
// 1. Create database backup
docker_db_backup("postgres", `./backups/pre-deploy-${Date.now()}.sql`)

// 2. Run full test suite
docker_exec("web", "npm run test:all")

// 3. Run integration tests
docker_exec("web", "npm run test:integration")

// 4. Check database status
docker_db_status("postgres")

// 5. Build production image
docker_compose_up({build: true})

// 6. Check logs for warnings
docker_container_logs("web", {lines: 200})

// 7. Ready to deploy! 🚀
```

### Debugging Production Issues

```typescript
// 1. Check container status
docker_container_list()

// 2. Check health
docker_healthcheck()

// 3. View recent logs
docker_container_logs("web", {lines: 500, timestamps: true})

// 4. Check database
docker_db_status("postgres")
docker_db_query("postgres", "SELECT COUNT(*) FROM users;")

// 5. Check Redis
docker_db_query("redis", "INFO")
docker_db_query("redis", "KEYS *")

// 6. Check environment
docker_env_list()

// 7. Run diagnostic commands
docker_exec("web", "node --version")
docker_exec("web", "npm list")
docker_exec("web", "df -h")  // Disk space
docker_exec("web", "free -m")  // Memory
```

### Database Maintenance

```typescript
// Weekly backup
docker_db_backup("postgres", `./backups/weekly-${Date.now()}.sql`)

// Check database size
docker_db_query("postgres", 
  "SELECT pg_size_pretty(pg_database_size(current_database()));"
)

// Check table sizes
docker_db_query("postgres", `
  SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
`)

// Vacuum database
docker_exec("postgres", "vacuumdb -U postgres -d mydb --analyze")

// Check slow queries (PostgreSQL)
docker_db_query("postgres", `
  SELECT query, calls, total_time, mean_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
`)
```

### Testing Workflows

```typescript
// Unit tests
docker_exec("web", "npm run test:unit")

// Integration tests
docker_exec("web", "npm run test:integration")

// E2E tests
docker_exec("web", "npm run test:e2e")

// Coverage report
docker_exec("web", "npm run test:coverage")

// Watch mode for TDD
docker_exec("web", "npm run test:watch")

// Specific test file
docker_exec("web", "npm test -- tests/user.test.js")

// Specific test case
docker_exec("web", "npm test -- -t 'should create user'")
```

---

## Tips & Tricks

### Combine Commands

```typescript
// Check status and logs
docker_healthcheck()
docker_container_logs("web", {lines: 50})

// Restart and follow logs
docker_container_restart("web")
docker_container_logs("web", {follow: true})

// Backup before dangerous operation
docker_db_backup("postgres", "./backup.sql")
docker_db_query("postgres", "DELETE FROM old_table;")
```

### Use Environment Variables

```typescript
// Check what env vars are set
docker_env_list()

// Use in commands
docker_exec("web", "echo $DATABASE_URL")
docker_exec("web", "printenv | grep DATABASE")
```

### Quick Database Checks

```typescript
// PostgreSQL
docker_db_query("postgres", "\\dt")  // List tables
docker_db_query("postgres", "\\du")  // List users
docker_db_query("postgres", "\\l")   // List databases

// Redis
docker_db_query("redis", "INFO")     // Server info
docker_db_query("redis", "DBSIZE")   // Number of keys
docker_db_query("redis", "KEYS *")   // All keys (use carefully!)
```

### Performance Monitoring

```typescript
// Check container resource usage (terminal)
// docker stats

// Check database connections
docker_db_query("postgres", 
  "SELECT count(*) FROM pg_stat_activity;"
)

// Check Redis memory
docker_db_query("redis", "INFO memory")

// Check disk space
docker_exec("web", "df -h")
```

---

## Remote Docker Management

### Production Server Management

**Setup:**
Configure SSH access in Cursor Secrets or MCP config:
```json
{
  "DOCKER_SSH_HOST": "prod.example.com",
  "DOCKER_SSH_USER": "deployer",
  "DOCKER_SSH_KEY": "/Users/me/.ssh/id_rsa_prod"
}
```

**Daily Operations:**

```typescript
// Check production containers
docker_container_list()
// Lists containers on remote production server

// View production logs
docker_container_logs("api", {lines: 100})
docker_container_logs("worker", {follow: true})

// Restart service after deployment
docker_container_restart("api")

// Check production database
docker_db_query("postgres", "SELECT COUNT(*) FROM users;")

// Create production backup
docker_db_backup("postgres", "./backups/prod-2024-12-31.sql")

// Monitor resource usage
docker_container_stats("api")
```

### Multi-Environment Management

**Setup with Profiles:**
```json
{
  "DOCKER_SSH_PROFILE": "production",
  "DOCKER_SSH_PROFILES": "{\"production\":{\"host\":\"prod.com\",\"username\":\"deployer\"},\"staging\":{\"host\":\"staging.com\",\"username\":\"deployer\"}}"
}
```

**Workflow:**

```typescript
// Switch to staging (update DOCKER_SSH_PROFILE to "staging")
// Restart Cursor to apply changes

// Test on staging first
docker_compose_up({build: true})
docker_exec("web", "npm test")
docker_db_query("postgres", "SELECT * FROM test_users;")

// Switch to production (update DOCKER_SSH_PROFILE to "production")
// Deploy after staging tests pass
docker_compose_up({build: true})
```

### Remote Development Server

**Scenario:** Team shares a remote development server

```typescript
// Connect to shared dev server
// (SSH config in MCP settings)

// Start development environment
docker_compose_up({build: true, detach: true})

// Run tests remotely
docker_exec("web", "npm test")

// Check logs from remote
docker_container_logs("web", {follow: true, lines: 50})

// Database work on remote
docker_db_query("postgres", "SELECT * FROM migrations;")
docker_exec("api", "python manage.py migrate")
```

### CI/CD Integration

**Using Remote Docker in CI/CD:**

```yaml
# .github/workflows/deploy.yml
env:
  DOCKER_SSH_HOST: ${{ secrets.PROD_SSH_HOST }}
  DOCKER_SSH_USER: ${{ secrets.PROD_SSH_USER }}
  DOCKER_SSH_KEY: ${{ secrets.PROD_SSH_KEY }}
```

**Deployment Script:**

```typescript
// Pre-deployment checks
docker_healthcheck()
docker_db_status("postgres")

// Create backup
docker_db_backup("postgres", "./backups/pre-deploy.sql")

// Deploy
docker_compose_up({build: true})

// Post-deployment verification
docker_healthcheck()
docker_container_logs("web", {lines: 20})
```

### Troubleshooting Remote Servers

```typescript
// Check connection
docker_mcp_health()
// Should show: "SSH configuration loaded for remote Docker: example.com:22"

// View remote container status
docker_container_list()
docker_healthcheck()

// Check remote logs for errors
docker_container_logs("api", {lines: 100, timestamps: true})

// Remote database diagnostics
docker_db_status("postgres")
docker_db_query("postgres", "SELECT * FROM pg_stat_activity;")

// Execute diagnostic commands remotely
docker_exec("web", "df -h")  // Disk space
docker_exec("web", "free -m") // Memory
docker_exec("web", "uptime")  // System uptime
```

---

**Real-world examples for Docker MCP Server v1.1.0**

