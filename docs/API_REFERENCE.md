# API Reference

> Complete reference for all Docker MCP Server commands

## Table of Contents

- [Container Management](#container-management)
- [Database Operations](#database-operations)
- [Environment & Config](#environment--config)
- [Universal Executor](#universal-executor)
- [MCP Health](#mcp-health)
- [CLI Interface](#cli-interface)

---

## Container Management

### docker_container_list

List all containers in the current project.

**Signature:**
```typescript
docker_container_list(options?: {
  project?: string;
  all?: boolean;
}): Promise<Container[]>
```

**Parameters:**
- `project` (optional) — Project name. Auto-detected if not provided.
- `all` (optional) — Show all containers including stopped. Default: `true`

**Returns:**
```typescript
interface Container {
  name: string;
  status: 'running' | 'exited' | 'paused' | 'restarting';
  image: string;
  ports: string[];
  created: string;
  health?: 'healthy' | 'unhealthy' | 'starting';
}
```

**Example:**
```typescript
// List all containers in current project
docker_container_list()

// List containers for specific project
docker_container_list({project: "my-app"})

// List only running containers
docker_container_list({all: false})
```

**Output:**
```
┌──────────────┬──────────┬─────────────────┬────────────┐
│ Name         │ Status   │ Image           │ Health     │
├──────────────┼──────────┼─────────────────┼────────────┤
│ web          │ running  │ node:18-alpine  │ healthy    │
│ postgres     │ running  │ postgres:15     │ healthy    │
│ redis        │ running  │ redis:7-alpine  │ -          │
└──────────────┴──────────┴─────────────────┴────────────┘
```

---

### docker_container_start

Start a stopped container.

**Signature:**
```typescript
docker_container_start(
  service: string,
  options?: {
    project?: string;
  }
): Promise<void>
```

**Parameters:**
- `service` (required) — Service name from docker-compose.yml
- `project` (optional) — Project name. Auto-detected if not provided.

**Example:**
```typescript
// Start the web service
docker_container_start("web")

// Start service in specific project
docker_container_start("web", {project: "my-app"})
```

**Output:**
```
✅ Container 'web' started successfully
```

---

### docker_container_stop

Stop a running container.

**Signature:**
```typescript
docker_container_stop(
  service: string,
  options?: {
    project?: string;
    timeout?: number;
  }
): Promise<void>
```

**Parameters:**
- `service` (required) — Service name
- `project` (optional) — Project name
- `timeout` (optional) — Seconds to wait before killing. Default: 10

**Example:**
```typescript
// Stop the web service
docker_container_stop("web")

// Stop with custom timeout
docker_container_stop("web", {timeout: 30})
```

**Output:**
```
✅ Container 'web' stopped successfully
```

---

### docker_container_restart

Restart a container.

**Signature:**
```typescript
docker_container_restart(
  service: string,
  options?: {
    project?: string;
    timeout?: number;
  }
): Promise<void>
```

**Parameters:**
- `service` (required) — Service name
- `project` (optional) — Project name
- `timeout` (optional) — Seconds to wait before killing. Default: 10

**Example:**
```typescript
// Restart the web service
docker_container_restart("web")

// Restart with custom timeout
docker_container_restart("web", {timeout: 30})
```

**Output:**
```
✅ Container 'web' restarted successfully
```

---

### docker_container_logs

View container logs.

**Signature:**
```typescript
docker_container_logs(
  service: string,
  options?: {
    project?: string;
    lines?: number;
    follow?: boolean;
    timestamps?: boolean;
    since?: string;
    until?: string;
  }
): Promise<string>
```

**Parameters:**
- `service` (required) — Service name
- `project` (optional) — Project name
- `lines` (optional) — Number of lines to show. Default: 100
- `follow` (optional) — Follow log output (stream). Default: false
- `timestamps` (optional) — Show timestamps. Default: false
- `since` (optional) — Show logs since timestamp (e.g., "2023-01-01T00:00:00")
- `until` (optional) — Show logs until timestamp

**Example:**
```typescript
// Show last 100 lines
docker_container_logs("web")

// Show last 50 lines with timestamps
docker_container_logs("web", {lines: 50, timestamps: true})

// Follow logs in real-time
docker_container_logs("web", {follow: true, lines: 20})

// Show logs from last hour
docker_container_logs("web", {since: "1h"})
```

**Output:**
```
2024-12-31T10:00:00Z Server starting on port 3000
2024-12-31T10:00:01Z Database connected
2024-12-31T10:00:02Z Ready to accept connections
...
```

---

### docker_compose_up

Start all services defined in docker-compose.yml.

**Signature:**
```typescript
docker_compose_up(options?: {
  project?: string;
  build?: boolean;
  detach?: boolean;
  services?: string[];
  scale?: Record<string, number>;
}): Promise<void>
```

**Parameters:**
- `project` (optional) — Project name
- `build` (optional) — Build images before starting. Default: false
- `detach` (optional) — Run in background. Default: true
- `services` (optional) — Start only specific services
- `scale` (optional) — Scale services (e.g., `{web: 3}`)

**Example:**
```typescript
// Start all services
docker_compose_up()

// Build and start
docker_compose_up({build: true})

// Start only specific services
docker_compose_up({services: ["web", "redis"]})

// Scale web service to 3 instances
docker_compose_up({scale: {web: 3}})
```

**Output:**
```
✅ Starting services...
   ✓ postgres (healthy)
   ✓ redis (healthy)
   ✓ web (healthy)
✅ All services started successfully
```

---

### docker_compose_down

Stop and remove all containers.

**Signature:**
```typescript
docker_compose_down(options?: {
  project?: string;
  volumes?: boolean;
  removeOrphans?: boolean;
  timeout?: number;
}): Promise<void>
```

**Parameters:**
- `project` (optional) — Project name
- `volumes` (optional) — Remove volumes. Default: false
- `removeOrphans` (optional) — Remove orphaned containers. Default: false
- `timeout` (optional) — Shutdown timeout. Default: 10

**Example:**
```typescript
// Stop all services
docker_compose_down()

// Stop and remove volumes
docker_compose_down({volumes: true})

// Stop with custom timeout
docker_compose_down({timeout: 30})
```

**Output:**
```
✅ Stopping services...
   ✓ web stopped
   ✓ redis stopped
   ✓ postgres stopped
✅ All services stopped successfully
```

---

## Database Operations

### docker_db_query

Execute a SQL query or database command.

**Signature:**
```typescript
docker_db_query(
  service: string,
  query: string,
  options?: {
    project?: string;
    database?: string;
    user?: string;
    format?: 'table' | 'json' | 'csv';
  }
): Promise<string>
```

**Parameters:**
- `service` (required) — Database service name
- `query` (required) — SQL query or database command
- `project` (optional) — Project name
- `database` (optional) — Database name (overrides auto-detection)
- `user` (optional) — Database user (overrides auto-detection)
- `format` (optional) — Output format. Default: 'table'

**Supported Databases:**
- PostgreSQL — SQL queries
- Redis — Redis commands (KEYS, GET, SET, etc.)
- SQLite — SQL queries
- MySQL — SQL queries (coming soon)

**Example:**

**PostgreSQL:**
```typescript
// Simple query
docker_db_query("postgres", "SELECT * FROM users LIMIT 5;")

// With specific database
docker_db_query("postgres", "SELECT version();", {database: "mydb"})

// JSON output
docker_db_query("postgres", "SELECT * FROM users;", {format: "json"})

// PostgreSQL meta-commands
docker_db_query("postgres", "\\dt")  // List tables
docker_db_query("postgres", "\\d users")  // Describe table
```

**Redis:**
```typescript
// Get all keys
docker_db_query("redis", "KEYS *")

// Get value
docker_db_query("redis", "GET user:123")

// Set value
docker_db_query("redis", "SET user:123 'John'")

// Get info
docker_db_query("redis", "INFO")
```

**SQLite:**
```typescript
// Query
docker_db_query("app", "SELECT * FROM users;")

// List tables
docker_db_query("app", ".tables")

// Schema
docker_db_query("app", ".schema users")
```

**Output:**
```
┌────┬──────────┬─────────────────────┐
│ id │ username │ email               │
├────┼──────────┼─────────────────────┤
│ 1  │ john     │ john@example.com    │
│ 2  │ jane     │ jane@example.com    │
└────┴──────────┴─────────────────────┘
```

---

### docker_db_backup

Create a database backup.

**Signature:**
```typescript
docker_db_backup(
  service: string,
  output?: string,
  options?: {
    project?: string;
    database?: string;
    format?: 'sql' | 'custom' | 'tar' | 'directory';
    compress?: boolean;
    tables?: string[];
  }
): Promise<string>
```

**Parameters:**
- `service` (required) — Database service name
- `output` (optional) — Output file path. Auto-generated if not provided.
- `project` (optional) — Project name
- `database` (optional) — Database name
- `format` (optional) — Backup format. Default: 'custom' (PostgreSQL), 'sql' (others)
- `compress` (optional) — Compress backup. Default: true
- `tables` (optional) — Backup only specific tables

**Example:**

**PostgreSQL:**
```typescript
// Simple backup
docker_db_backup("postgres")
// → ./backup-postgres-20241231-100000.dump

// Custom output path
docker_db_backup("postgres", "./backups/pre-deploy.sql")

// SQL format
docker_db_backup("postgres", "./backup.sql", {format: "sql"})

// Backup specific tables
docker_db_backup("postgres", "./users.dump", {
  tables: ["users", "profiles"]
})
```

**Redis:**
```typescript
// Create RDB snapshot
docker_db_backup("redis")
// → ./backup-redis-20241231-100000.rdb

// Custom output
docker_db_backup("redis", "./backups/redis.rdb")
```

**SQLite:**
```typescript
// Backup database file
docker_db_backup("app")
// → ./backup-sqlite-20241231-100000.db

// Custom output
docker_db_backup("app", "./backups/database.db")
```

**Output:**
```
✅ Backup created successfully
   Location: ./backup-postgres-20241231-100000.dump
   Size: 2.5 MB
   Format: custom (compressed)
```

---

### docker_db_restore

Restore database from backup.

**Signature:**
```typescript
docker_db_restore(
  service: string,
  backupPath: string,
  options?: {
    project?: string;
    database?: string;
    clean?: boolean;
    dataOnly?: boolean;
    schemaOnly?: boolean;
  }
): Promise<void>
```

**Parameters:**
- `service` (required) — Database service name
- `backupPath` (required) — Path to backup file
- `project` (optional) — Project name
- `database` (optional) — Target database name
- `clean` (optional) — Drop database before restore. Default: false
- `dataOnly` (optional) — Restore only data. Default: false
- `schemaOnly` (optional) — Restore only schema. Default: false

**Example:**

**PostgreSQL:**
```typescript
// Simple restore
docker_db_restore("postgres", "./backup.dump")

// Clean restore (drop existing data)
docker_db_restore("postgres", "./backup.dump", {clean: true})

// Restore only data
docker_db_restore("postgres", "./backup.dump", {dataOnly: true})

// Restore to different database
docker_db_restore("postgres", "./backup.dump", {database: "test_db"})
```

**Redis:**
```typescript
// Restore from RDB file
docker_db_restore("redis", "./backup.rdb")
```

**SQLite:**
```typescript
// Restore database file
docker_db_restore("app", "./backup.db")
```

**Output:**
```
✅ Restore completed successfully
   Database: mydb
   Tables restored: 15
   Rows restored: 10,523
```

---

### docker_db_status

Get database status and statistics.

**Signature:**
```typescript
docker_db_status(
  service: string,
  options?: {
    project?: string;
  }
): Promise<DBStatus>
```

**Parameters:**
- `service` (required) — Database service name
- `project` (optional) — Project name

**Returns:**
```typescript
interface DBStatus {
  type: 'postgresql' | 'redis' | 'mysql' | 'sqlite' | 'mongodb';
  version: string;
  status: 'healthy' | 'unhealthy';
  size?: string;
  connections?: number;
  uptime?: string;
  memory?: string;
  additional?: Record<string, any>;
}
```

**Example:**
```typescript
// PostgreSQL status
docker_db_status("postgres")

// Redis status
docker_db_status("redis")
```

**Output (PostgreSQL):**
```
Database Status: postgres
├─ Type: PostgreSQL
├─ Version: 15.3
├─ Status: healthy
├─ Size: 125 MB
├─ Connections: 5 active / 100 max
├─ Uptime: 3 days 5 hours
└─ Tables: 23
```

**Output (Redis):**
```
Database Status: redis
├─ Type: Redis
├─ Version: 7.2.0
├─ Status: healthy
├─ Memory: 2.5 MB used / 512 MB max
├─ Uptime: 3 days 5 hours
├─ Keys: 1,234
└─ Clients: 3 connected
```

---

## Environment & Config

### docker_env_list

List environment variables from .env files and docker-compose.yml.

**Signature:**
```typescript
docker_env_list(options?: {
  project?: string;
  maskSecrets?: boolean;
  service?: string;
}): Promise<Record<string, string>>
```

**Parameters:**
- `project` (optional) — Project name
- `maskSecrets` (optional) — Mask sensitive values. Default: true
- `service` (optional) — Show env for specific service only

**Example:**
```typescript
// List all environment variables
docker_env_list()

// Show without masking (use with caution!)
docker_env_list({maskSecrets: false})

// Show env for specific service
docker_env_list({service: "web"})
```

**Output:**
```
Environment Variables:
├─ NODE_ENV=production
├─ PORT=3000
├─ DATABASE_URL=***MASKED***
├─ REDIS_URL=redis://redis:6379
├─ API_KEY=***MASKED***
├─ JWT_SECRET=***MASKED***
└─ LOG_LEVEL=info

🔒 3 secrets masked
```

---

### docker_compose_config

Show parsed docker-compose configuration.

**Signature:**
```typescript
docker_compose_config(options?: {
  project?: string;
  services?: string[];
  resolve?: boolean;
}): Promise<string>
```

**Parameters:**
- `project` (optional) — Project name
- `services` (optional) — Show config for specific services only
- `resolve` (optional) — Resolve variables. Default: true

**Example:**
```typescript
// Show full config
docker_compose_config()

// Show specific services
docker_compose_config({services: ["web", "postgres"]})

// Show without resolving variables
docker_compose_config({resolve: false})
```

**Output:**
```yaml
services:
  web:
    image: node:18-alpine
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@postgres:5432/db
    depends_on:
      - postgres
  
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

---

### docker_healthcheck

Check health status of all services.

**Signature:**
```typescript
docker_healthcheck(options?: {
  project?: string;
  services?: string[];
}): Promise<HealthStatus>
```

**Parameters:**
- `project` (optional) — Project name
- `services` (optional) — Check specific services only

**Returns:**
```typescript
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'starting' | 'none';
    checks: number;
    failures: number;
  }>;
}
```

**Example:**
```typescript
// Check all services
docker_healthcheck()

// Check specific services
docker_healthcheck({services: ["web", "postgres"]})
```

**Output:**
```
Health Check Results:
├─ Overall Status: healthy
│
├─ web
│  ├─ Status: healthy
│  ├─ Checks: 10
│  └─ Failures: 0
│
├─ postgres
│  ├─ Status: healthy
│  ├─ Checks: 10
│  └─ Failures: 0
│
└─ redis
   ├─ Status: healthy (no healthcheck defined)
   └─ Container: running
```

---

## Universal Executor

### docker_exec

Execute any command in a container.

**Signature:**
```typescript
docker_exec(
  service: string,
  command: string,
  options?: {
    project?: string;
    interactive?: boolean;
    user?: string;
    workdir?: string;
    env?: Record<string, string>;
  }
): Promise<string>
```

**Parameters:**
- `service` (required) — Service name
- `command` (required) — Command to execute
- `project` (optional) — Project name
- `interactive` (optional) — Interactive mode. Default: false
- `user` (optional) — Run as specific user
- `workdir` (optional) — Working directory
- `env` (optional) — Additional environment variables

**Example:**

**Run tests:**
```typescript
docker_exec("web", "npm test")
docker_exec("web", "pytest tests/")
docker_exec("web", "python manage.py test")
```

**Database migrations:**
```typescript
docker_exec("web", "alembic upgrade head")
docker_exec("web", "python manage.py migrate")
docker_exec("web", "npm run migrate")
```

**Shell commands:**
```typescript
docker_exec("web", "ls -la /app")
docker_exec("web", "cat /app/config.json")
docker_exec("web", "ps aux")
```

**Python REPL:**
```typescript
docker_exec("web", "python", {interactive: true})
```

**Custom user:**
```typescript
docker_exec("web", "whoami", {user: "root"})
```

**Custom working directory:**
```typescript
docker_exec("web", "ls", {workdir: "/app/src"})
```

**With environment variables:**
```typescript
docker_exec("web", "npm test", {
  env: {
    NODE_ENV: "test",
    DEBUG: "true"
  }
})
```

**Output:**
```
$ npm test

> my-app@1.0.0 test
> jest

 PASS  tests/unit/user.test.js
 PASS  tests/integration/api.test.js

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Time:        2.5s
```

---

## Error Handling

All commands return errors in a consistent format:

```typescript
interface MCPError {
  code: number;
  message: string;
  details?: any;
}
```

**Common Error Codes:**
- `-32600` — Invalid request
- `-32601` — Method not found
- `-32602` — Invalid parameters
- `-32603` — Internal error

**Example Error:**
```json
{
  "code": -32603,
  "message": "Container 'web' not found",
  "details": {
    "service": "web",
    "project": "my-app",
    "availableServices": ["postgres", "redis"]
  }
}
```

---

## MCP Health

### docker_mcp_health

Check the health status of the MCP server and its dependencies.

**Signature:**
```typescript
docker_mcp_health(): Promise<HealthStatus>
```

**Returns:**
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  docker: { connected: boolean; version?: string };
  project: { found: boolean; path?: string };
  adapters: { registered: number; available: string[] };
  cache: { enabled: boolean; size?: number };
}
```

**Example:**
```typescript
docker_mcp_health()
```

---

## CLI Interface

The Docker MCP Server includes a CLI interface for direct command execution.

### Installation

```bash
npm install -g @hypnosis/docker-mcp-server
```

### Commands

```bash
docker-mcp-server-cli ps                    # List containers
docker-mcp-server-cli up                   # Start services
docker-mcp-server-cli exec <service> "<cmd>"  # Execute command
docker-mcp-server-cli logs <service> [--lines N]  # View logs
docker-mcp-server-cli env-list             # Environment variables
docker-mcp-server-cli healthcheck          # Health check
docker-mcp-server-cli mcp-health           # Server diagnostics
```

### Container Discovery

Uses three-level fallback:
1. Docker Compose Labels (priority)
2. docker-compose ps CLI (fallback)
3. Name-based filter (final fallback)

---

**Complete API reference for Docker MCP Server v1.0.0**

