# Docker MCP Server

[![npm version](https://img.shields.io/npm/v/@hypnosis/docker-mcp-server.svg)](https://www.npmjs.com/package/@hypnosis/docker-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Universal Docker MCP server for AI assistants (Cursor, Claude Desktop). Manage Docker containers, execute commands, query databases, and handle environment configurations — all through natural language.

## ✨ Features

- ✅ **20 MCP Commands** — Container management, database operations, environment handling, resource monitoring, project discovery
- ✅ **Database Support** — PostgreSQL, Redis, SQLite with extensible adapter pattern
- ✅ **Resource Monitoring** — Container stats (CPU, Memory, Network, Block I/O), images, volumes, networks
- ✅ **Auto-Discovery** — Automatically finds and parses `docker-compose.yml` files (local and remote)
- ✅ **Remote Docker** — SSH support for managing remote Docker hosts
- ✅ **Remote Project Discovery** — Automatically find all Docker projects on remote servers
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

**Local Docker (simplest - no configuration needed!):**
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

That's it! The server will automatically detect and use your local Docker installation.

**Optional: Enable auto-discovery and secret masking:**
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

**Remote Docker (with profiles file):**
```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"],
      "env": {
        "DOCKER_MCP_PROFILES_FILE": "~/.docker-mcp/profiles.json"
      }
    }
  }
}
```

Create `~/.docker-mcp/profiles.json`:
```json
{
  "default": "production",
  "profiles": {
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

**Note:** `projectsPath` specifies where to search for Docker projects on remote server (default: `/var/www`).

**Note:** If the profiles file doesn't exist or is invalid, the server will gracefully fall back to local Docker — no errors, no configuration needed!

### Using Profiles in Commands

Starting from v1.3.0, you can specify a `profile` parameter in any command to work with remote servers:

```typescript
// List containers on remote production server
docker_container_list({profile: "production"})

// Query database on remote server
docker_db_query({service: "postgres", query: "SELECT * FROM users;", profile: "production"})

// Check status on staging server
docker_container_stats({service: "web", profile: "staging"})

// Local Docker (default, no profile needed)
docker_container_list()  // Uses local Docker automatically
```

See [Remote Docker Guide](docs/REMOTE_DOCKER.md) for detailed information about profiles and remote management.

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

### Container Management (9 commands)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_container_list` | List all containers (grouped by project) | `docker_container_list()` |
| `docker_container_start` | Start a container | `docker_container_start({service: "web"})` |
| `docker_container_stop` | Stop a container | `docker_container_stop({service: "web"})` |
| `docker_container_restart` | Restart a container | `docker_container_restart({service: "web"})` |
| `docker_container_logs` | View container logs | `docker_container_logs({service: "web", follow: true, lines: 100})` |
| `docker_container_stats` | Get container resource usage | `docker_container_stats({service: "web"})` |
| `docker_compose_up` | Start entire stack | `docker_compose_up({build: true})` |
| `docker_compose_down` | Stop entire stack | `docker_compose_down({volumes: false})` |
| `docker_resource_list` | List Docker images, volumes, or networks | `docker_resource_list({type: "images"})` |

### Database Operations (4 commands)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_db_query` | Execute SQL query or database command | `docker_db_query({service: "postgres", query: "SELECT * FROM users LIMIT 5;"})` |
| `docker_db_backup` | Create database backup | `docker_db_backup({service: "postgres", compress: true})` |
| `docker_db_restore` | Restore from backup | `docker_db_restore({service: "postgres", backupPath: "./backup.sql"})` |
| `docker_db_status` | Show database status | `docker_db_status({service: "postgres"})` |

### Environment & Config (3 commands)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_env_list` | List environment variables (with secret masking) | `docker_env_list({service: "web", maskSecrets: true})` |
| `docker_compose_config` | Show parsed compose config | `docker_compose_config()` |
| `docker_healthcheck` | Check health of all services | `docker_healthcheck()` |

### Universal Executor (1 command)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_exec` | Execute any command in container | `docker_exec({service: "web", command: "npm test"})` |

### Project Discovery (1 command)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_projects` | List all Docker projects with status (fast, ~2s) | `docker_projects()` |

**Note:** For detailed container info, use `docker_container_list({project: "project-name"})`.

### Utility Tools (2 commands)

| Command | Description | Example |
|---------|-------------|---------|
| `docker_mcp_health` | Server diagnostics and health check | `docker_mcp_health()` |
| `docker_profile_info` | Show current profile and available profiles | `docker_profile_info()` |

## 💡 Usage Examples

### Example 1: Web Development (Next.js + Redis)

```typescript
// Start the entire stack
docker_compose_up({build: true, detach: true})

// Check if services are healthy
docker_healthcheck()

// View logs in real-time
docker_container_logs({service: "web", follow: true, lines: 50})

// Check Redis cache
docker_db_query({service: "redis", query: "KEYS *"})

// Run tests
docker_exec({service: "web", command: "npm test"})
```

### Example 2: Backend Development (Django + PostgreSQL)

```typescript
// Restart backend after code changes
docker_container_restart({service: "web"})

// Run database migrations
docker_exec({service: "web", command: "python manage.py migrate"})

// Query database
docker_db_query({service: "postgres", query: "SELECT COUNT(*) FROM auth_user;"})

// Create backup before deployment
docker_db_backup({service: "postgres", compress: true})

// View application logs
docker_container_logs({service: "web", lines: 100, timestamps: true})
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
- **[Remote Docker Guide](docs/REMOTE_DOCKER.md)** — SSH-based remote Docker management
- **[Remote Discovery Guide](docs/REMOTE_DISCOVERY.md)** — Automatic project discovery on remote servers
- **[Examples](docs/EXAMPLES.md)** — Real-world usage scenarios
- **[Testing System](docs/testing/README.md)** — Complete testing guide (E2E, Unit, Manual)
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** — Common issues and solutions
- **[FAQ](docs/FAQ.md)** — Frequently asked questions
- **[Roadmap](docs/ROADMAP.md)** — Future development plans and upcoming features

For developer documentation, see [docs/DEV/README.md](docs/DEV/README.md)

### Roadmap Overview

The project roadmap outlines planned features and releases. Key upcoming features include:

- **v1.4.0 (Q1 2026)**: MySQL and MongoDB adapters
- **v1.5.0 (Q2 2026)**: Enhanced monitoring and analytics
- **v2.0.0 (Q3 2026)**: Plugin system and major architecture update
- **v2.1.0 (Q4 2026)**: Network, volume, and image management

See [docs/ROADMAP.md](docs/ROADMAP.md) for detailed information about future plans, priorities, and how to contribute to the roadmap.

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
