# Docker MCP Server

[![npm version](https://img.shields.io/npm/v/@hypnosis/docker-mcp-server.svg)](https://www.npmjs.com/package/@hypnosis/docker-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Universal Docker MCP server for AI assistants (Cursor, Claude Desktop). Manage Docker containers, execute commands, query databases, and handle environment configurations — all through natural language.

## ✨ Features

- ✅ **15 MCP Commands** — Container management, database operations, environment handling
- ✅ **Database Support** — PostgreSQL, Redis, SQLite with extensible adapter pattern
- ✅ **Auto-Discovery** — Automatically finds and parses `docker-compose.yml` files
- ✅ **Security** — Automatic secrets masking in environment variables
- ✅ **Follow Logs** — Real-time log streaming with `follow` mode
- ✅ **Type-Safe** — Written in TypeScript with full type definitions
- ✅ **Universal** — Works with any Docker project

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g @hypnosis/docker-mcp-server
```

### NPX (No Installation)

```bash
npx @hypnosis/docker-mcp-server
```

### Local Installation

```bash
npm install @hypnosis/docker-mcp-server
```

## 🚀 Quick Start

### Configuration for Cursor

Add to `~/.cursor/mcp.json` (or `~/.config/cursor/mcp.json`):

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"],
      "env": {
        "DOCKER_MCP_AUTO_DISCOVER": "true",
        "DOCKER_MCP_MASK_SECRETS": "true"
      }
    }
  }
}
```

### Configuration for Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

### First Steps

1. **Restart your AI assistant** (Cursor or Claude Desktop)
2. **Navigate to your Docker project** directory (with `docker-compose.yml`)
3. **Ask your AI assistant:**
   - "Show me the status of all containers"
   - "Restart the web service"
   - "Show me the last 50 lines of logs from the database"

## 📚 Available Commands

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

## 🏗️ How It Works

### Project Discovery

The server automatically discovers your project structure:

1. **Finds `docker-compose.yml`** in current directory or parent directories
2. **Parses project configuration** (services, networks, volumes)
3. **Detects database types** (PostgreSQL, Redis, SQLite)
4. **Loads environment files** (`.env`, `.env.local`)
5. **Masks secrets** automatically (PASSWORD, TOKEN, KEY, etc.)

### Database Adapters

Extensible adapter pattern for different databases:

- **PostgreSQL** — `psql`, `pg_dump`, `pg_restore`
- **Redis** — `redis-cli`, `SAVE`, `BGSAVE`
- **SQLite** — `.dump`, `.restore`
- More databases can be added via adapters

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

## 📖 Documentation

- **[Quick Start Guide](docs/QUICK_START.md)** — Detailed setup instructions
- **[API Reference](docs/API_REFERENCE.md)** — Complete command documentation
- **[Examples](docs/EXAMPLES.md)** — Real-world usage scenarios
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** — Common issues and solutions
- **[FAQ](docs/FAQ.md)** — Frequently asked questions

For developer documentation, see [docs/DEV/README.md](docs/DEV/README.md)

## 🤝 Contributing

We welcome contributions! This is an open-source project built for the community.

### How to Contribute

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

See [docs/DEV/README.md](docs/DEV/README.md) for development setup and guidelines.

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

Copyright (c) 2025 Danila Susak

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Docker](https://www.docker.com/) for containerization
- Community feedback and contributions

## 📬 Support

- **Issues:** [GitHub Issues](https://github.com/hypnosis/docker-mcp-server/issues)
- **Discussions:** [GitHub Discussions](https://github.com/hypnosis/docker-mcp-server/discussions)

---

**Made with ❤️ for the AI-powered development community**
