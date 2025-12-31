# Docker MCP Server

> Universal Docker management server for AI assistants (Cursor, Claude Desktop, etc.)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/%40your-username%2Fdocker-mcp-server.svg)](https://www.npmjs.com/package/@your-username/docker-mcp-server)

## 🎯 Overview

**Docker MCP Server** is a universal Model Context Protocol (MCP) server that enables AI assistants to manage Docker containers, execute commands, query databases, and handle environment configurations — all through natural language.

### Key Features

✅ **Universal** — Works with any Docker project, auto-discovers structure  
✅ **15 Commands** — Container management, database operations, environment handling  
✅ **Database Support** — PostgreSQL, Redis, SQLite with extensible adapter pattern  
✅ **Auto-Discovery** — Automatically finds and parses `docker-compose.yml`  
✅ **Security** — Automatic secrets masking in environment variables  
✅ **Follow Logs** — Real-time log streaming with `follow` mode  
✅ **Type-Safe** — Written in TypeScript with full type definitions  

---

## 🚀 Quick Start

### Installation

#### Global Installation (Recommended)

```bash
npm install -g @your-username/docker-mcp-server
```

#### NPX (No Installation)

```bash
npx @your-username/docker-mcp-server
```

### Configuration

#### For Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@your-username/docker-mcp-server"],
      "env": {
        "DOCKER_MCP_AUTO_DISCOVER": "true",
        "DOCKER_MCP_MASK_SECRETS": "true"
      }
    }
  }
}
```

#### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@your-username/docker-mcp-server"]
    }
  }
}
```

### First Steps

1. **Restart your AI assistant** (Cursor or Claude Desktop)
2. **Navigate to your Docker project** directory
3. **Ask your AI assistant:**
   - "Show me the status of all containers"
   - "Restart the web service"
   - "Show me the last 50 lines of logs from the database"

---

## 📚 Commands

### Container Management (7 commands)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_container_list` | List all containers in project | `docker_container_list()` |
| `docker_container_start` | Start a container | `docker_container_start("web")` |
| `docker_container_stop` | Stop a container | `docker_container_stop("web")` |
| `docker_container_restart` | Restart a container | `docker_container_restart("web")` |
| `docker_container_logs` | View container logs | `docker_container_logs("web", {follow: true, lines: 100})` |
| `docker_compose_up` | Start entire stack | `docker_compose_up({build: true})` |
| `docker_compose_down` | Stop entire stack | `docker_compose_down({volumes: false})` |

### Database Operations (4 commands)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_db_query` | Execute SQL query | `docker_db_query("postgres", "SELECT * FROM users LIMIT 5;")` |
| `docker_db_backup` | Create database backup | `docker_db_backup("postgres", "./backup.sql")` |
| `docker_db_restore` | Restore from backup | `docker_db_restore("postgres", "./backup.sql")` |
| `docker_db_status` | Show database status | `docker_db_status("postgres")` |

### Environment & Config (3 commands)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_env_list` | List environment variables | `docker_env_list()` |
| `docker_compose_config` | Show parsed compose config | `docker_compose_config()` |
| `docker_healthcheck` | Check health of all services | `docker_healthcheck()` |

### Universal Executor (1 command)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_exec` | Execute any command in container | `docker_exec("web", "npm test")` |

---

## 💡 Usage Examples

### Example 1: Web Development (Next.js + Redis)

```typescript
// Start the entire stack
docker_compose_up({build: true, detach: true})

// Check if services are healthy
docker_healthcheck()

// View logs in real-time
docker_container_logs("web", {follow: true, lines: 50})

// Check Redis cache
docker_db_query("redis", "KEYS *")

// Run tests
docker_exec("web", "npm test")
```

### Example 2: Backend Development (Django + PostgreSQL)

```typescript
// Restart backend after code changes
docker_container_restart("web")

// Run database migrations
docker_exec("web", "python manage.py migrate")

// Query database
docker_db_query("postgres", "SELECT COUNT(*) FROM auth_user;")

// Create backup before deployment
docker_db_backup("postgres", "./backups/pre-deploy.sql")

// View application logs
docker_container_logs("web", {lines: 100, timestamps: true})
```

### Example 3: Telegram Bot (Python + PostgreSQL)

```typescript
// Check container status
docker_container_list()

// Run tests
docker_exec("bot", "pytest tests/")

// Run Alembic migrations
docker_exec("bot", "alembic upgrade head")

// Check database tables
docker_db_query("postgres", "\\dt")

// View bot logs with follow
docker_container_logs("bot", {follow: true})
```

---

## 🏗️ Architecture

### Project Discovery

The server automatically discovers your project structure:

1. **Finds `docker-compose.yml`** in current directory or parent directories
2. **Parses project configuration** (services, networks, volumes)
3. **Detects database types** (PostgreSQL, Redis, MySQL, etc.)
4. **Loads environment files** (`.env`, `.env.local`)
5. **Masks secrets** automatically (PASSWORD, TOKEN, KEY, etc.)

### Database Adapters

Extensible adapter pattern for different databases:

- **PostgreSQL** — `psql`, `pg_dump`, `pg_restore`
- **Redis** — `redis-cli`, `SAVE`, `BGSAVE`
- **SQLite** — `.dump`, `.restore`
- **MySQL** — `mysql`, `mysqldump` (coming soon)
- **MongoDB** — `mongosh`, `mongodump` (coming soon)

---

## 🔒 Security

### Automatic Secrets Masking

Environment variables containing sensitive data are automatically masked:

```typescript
// Original .env
DATABASE_PASSWORD=super_secret_123
API_TOKEN=abc123xyz

// Output from docker_env_list()
DATABASE_PASSWORD=***MASKED***
API_TOKEN=***MASKED***
```

Keywords that trigger masking: `PASSWORD`, `TOKEN`, `KEY`, `SECRET`, `API_KEY`

### SQL Validation (Optional)

Enable SQL validation to prevent dangerous operations:

```json
{
  "env": {
    "DOCKER_MCP_VALIDATE_SQL": "true"
  }
}
```

Blocks: `DROP DATABASE`, `DELETE` without `WHERE`, `TRUNCATE`

---

## 🛠️ Development

### Project Structure

```
docker-mcp-server/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── discovery/                # Project auto-discovery
│   ├── adapters/                 # Database adapters
│   ├── managers/                 # Container/Compose/Env managers
│   ├── security/                 # Secrets masking
│   └── tools/                    # MCP tool implementations
├── tests/                        # Unit and integration tests
├── examples/                     # Usage examples
└── docs/                         # Documentation
```

### Building from Source

```bash
git clone https://github.com/your-username/docker-mcp-server.git
cd docker-mcp-server
npm install
npm run build
npm link
```

### Running Tests

```bash
npm test                  # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
```

---

## 📖 Documentation

- [Architecture](./ARCHITECTURE.md) — System design and patterns
- [API Reference](./API_REFERENCE.md) — Complete command reference
- [Database Adapters](./DATABASE_ADAPTERS.md) — How to add new databases
- [Examples](./EXAMPLES.md) — Real-world usage scenarios
- [Design Decisions](./DESIGN_DECISIONS.md) — Why we made certain choices

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### Adding a New Database Adapter

1. Create adapter in `src/adapters/your-database.ts`
2. Implement `DatabaseAdapter` interface
3. Register in `src/adapters/index.ts`
4. Add tests
5. Update documentation

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Docker](https://www.docker.com/) for containerization
- Community feedback and contributions

---

## 📬 Support

- **Issues:** [GitHub Issues](https://github.com/your-username/docker-mcp-server/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-username/docker-mcp-server/discussions)
- **Twitter:** [@your-username](https://twitter.com/your-username)

---

**Made with ❤️ for the AI-powered development community**

