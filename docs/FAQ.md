# Frequently Asked Questions (FAQ)

Common questions about Docker MCP Server.

---

## 📦 Installation & Setup

### Q: How do I install Docker MCP Server?

**A:** You have three options:

1. **Global installation (recommended):**
   ```bash
   npm install -g @hypnosis/docker-mcp-server
   ```

2. **Use npx (no installation):**
   ```bash
   npx @hypnosis/docker-mcp-server
   ```
   Configure Cursor/Claude Desktop to use `npx` with `-y` flag.

3. **Local installation:**
   ```bash
   npm install @hypnosis/docker-mcp-server
   ```

### Q: What are the requirements?

**A:**
- **Node.js** >= 18.0.0
- **Docker** (Docker Desktop or Docker Engine)
- **docker-compose** (usually included with Docker Desktop)
- **Cursor** or **Claude Desktop** with MCP support

### Q: How do I configure it in Cursor?

**A:** Add to `~/.cursor/mcp.json` (or `~/.config/cursor/mcp.json`):

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

Then restart Cursor.

### Q: How do I configure it in Claude Desktop?

**A:** Add to configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Then restart Claude Desktop.

---

## 🎯 Usage

### Q: What commands are available?

**A:** 20 MCP commands total:

- **Container Management (9):** list, start, stop, restart, logs, stats, compose up, compose down, resource_list
- **Database Operations (4):** query, backup, restore, status
- **Environment & Config (3):** env_list, compose_config, healthcheck
- **Universal Executor (1):** docker_exec
- **Project Discovery (1):** docker_projects
- **Utility Tools (2):** docker_mcp_health, docker_profile_info

See [API Reference](./API_REFERENCE.md) for complete documentation.

### Q: How do I find my service names?

**A:** Use `docker_container_list()` to see all available services in your project. Service names come from `docker-compose.yml`.

### Q: Does it work with multiple docker-compose files?

**A:** Yes! The server automatically discovers and merges multiple `docker-compose.yml` files in parent directories. It uses intelligent merging to combine configurations.

### Q: Can I use it without docker-compose?

**A:** Currently, the server is designed for docker-compose projects. It uses compose files for project discovery and service identification. Standalone containers are not yet supported.

---

## 🗄️ Databases

### Q: What databases are supported?

**A:** Currently supported:
- **PostgreSQL** (via `psql`, `pg_dump`, `pg_restore`)
- **Redis** (via `redis-cli`)
- **SQLite** (via `.dump`, `.restore`)

More databases can be added via the adapter pattern.

### Q: How does database detection work?

**A:** The server automatically detects database types from your `docker-compose.yml` by analyzing service images. If you use standard images like `postgres:15`, `redis:7`, or `sqlite`, detection works automatically.

### Q: Can I add support for MySQL/MongoDB/etc.?

**A:** Yes! The project uses an extensible adapter pattern. See [DATABASE_ADAPTERS.md](./DATABASE_ADAPTERS.md) for a step-by-step guide on creating new adapters.

### Q: How do database commands work?

**A:** Commands execute inside the database container using native tools:
- PostgreSQL: `psql` for queries, `pg_dump` for backups
- Redis: `redis-cli` for operations
- SQLite: `.dump` and `.restore` commands

The server handles connection details automatically from your compose configuration.

---

## 🔐 Security

### Q: How does secrets masking work?

**A:** Environment variables containing sensitive keywords (`PASSWORD`, `TOKEN`, `KEY`, `SECRET`, `API_KEY`) are automatically masked when listing environment variables. Enable with:

```json
{
  "env": {
    "DOCKER_MCP_MASK_SECRETS": "true"
  }
}
```

### Q: Is SQL validation enabled by default?

**A:** No, SQL validation is optional. Enable it with:

```json
{
  "env": {
    "DOCKER_MCP_VALIDATE_SQL": "true"
  }
}
```

When enabled, it blocks dangerous operations like `DROP DATABASE`, `DELETE` without `WHERE`, etc.

### Q: Is my data safe?

**A:** The server only reads configuration and executes commands through Docker API. It doesn't store or transmit your data. All operations happen locally on your machine.

---

## 🏗️ Architecture

### Q: How does project discovery work?

**A:** The server:
1. Searches current directory and parent directories for `docker-compose.yml`
2. Parses YAML configuration
3. Detects services, databases, networks, volumes
4. Loads environment files (`.env`, `.env.local`)
5. Caches results for performance

### Q: Does it work with Docker Swarm/Kubernetes?

**A:** Currently, the server focuses on docker-compose projects. Swarm and Kubernetes support may be added in future versions.

### Q: Can I use it with remote Docker hosts?

**A:** Yes! Starting from v1.3.0, the server fully supports remote Docker hosts via SSH profiles. You can:

1. **Configure profiles** in `~/.docker-mcp/profiles.json` or via `DOCKER_PROFILES_FILE`
2. **Use profile parameter** in any command: `docker_container_list({profile: "production"})`
3. **Work with multiple environments** in the same session (local, staging, production)

See [Remote Docker Guide](./REMOTE_DOCKER.md) for detailed setup instructions.

---

## 🐛 Troubleshooting

### Q: Server fails to start with "Docker check failed"

**A:** This usually means Docker isn't running or accessible. Check:
1. Docker Desktop is running
2. `docker ps` works in terminal
3. Permissions are correct (Linux: user in `docker` group)

### Q: Commands fail with "Container not found"

**A:** 
1. Use `docker_container_list()` to see available services
2. Verify service name matches `docker-compose.yml` exactly (case-sensitive)
3. Ensure containers are running: `docker ps`

### Q: Can't find docker-compose.yml

**A:**
1. Ensure you're in a directory with `docker-compose.yml` (or subdirectory)
2. Server searches parent directories too
3. Check file name: `docker-compose.yml` or `docker-compose.yaml`

### Q: Database commands don't work

**A:**
1. Check database type is supported (PostgreSQL, Redis, SQLite)
2. Verify container is running
3. Use exact service name from `docker-compose.yml`
4. Check container logs for errors

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for more solutions.

---

## 🔧 Development

### Q: How can I contribute?

**A:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

See [docs/DEV/README.md](./DEV/README.md) for development setup.

### Q: How do I add a new database adapter?

**A:** See [DATABASE_ADAPTERS.md](./DATABASE_ADAPTERS.md) for a complete guide. The process involves:
1. Creating adapter class implementing `DatabaseAdapter` interface
2. Registering in adapter registry
3. Adding tests
4. Updating documentation

### Q: How do I run tests?

**A:**
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

---

## 📚 Documentation

### Q: Where can I find complete documentation?

**A:**
- **[README.md](../README.md)** — Overview and quick start
- **[API Reference](./API_REFERENCE.md)** — All commands documented
- **[Examples](./EXAMPLES.md)** — Real-world usage
- **[Troubleshooting](./TROUBLESHOOTING.md)** — Common issues
- **[Developer Docs](./DEV/README.md)** — For contributors

### Q: Are there example projects?

**A:** Yes! See [EXAMPLES.md](./EXAMPLES.md) for:
- Web development (Next.js + PostgreSQL + Redis)
- Backend API (Django + PostgreSQL)
- Telegram Bot (Python + PostgreSQL)
- Data Science (Jupyter + PostgreSQL)
- Common workflows

---

## 🆘 Support

### Q: Where can I get help?

**A:**
- **GitHub Issues** — Bug reports and feature requests
- **GitHub Discussions** — Questions and discussions
- **Documentation** — Check docs first!

### Q: How do I report a bug?

**A:**
1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md) first
2. Search existing GitHub Issues
3. Create new issue with:
   - Description of problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, Node version, Docker version)

---

## 🎯 Future Plans

### Q: What's coming next?

**A:** Potential future features:
- Support for more databases (MySQL, MongoDB, etc.)
- Docker Swarm/Kubernetes support
- Better error messages and diagnostics
- Performance optimizations
- Web UI for monitoring

Check GitHub Issues and Discussions for roadmap discussions.

---

**Still have questions?** Open a GitHub Discussion or Issue!

**Last Updated:** 2026-01-10 (v1.3.0)

