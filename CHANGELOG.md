# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-01-01

### Added

#### Core Features
- **15 MCP Commands** for Docker container management
  - Container Management (7): `docker_container_list`, `docker_container_start`, `docker_container_stop`, `docker_container_restart`, `docker_container_logs`, `docker_compose_up`, `docker_compose_down`
  - Database Operations (4): `docker_db_query`, `docker_db_backup`, `docker_db_restore`, `docker_db_status`
  - Environment & Config (3): `docker_env_list`, `docker_compose_config`, `docker_healthcheck`
  - Universal Executor (1): `docker_exec`

#### Project Discovery
- Automatic discovery of `docker-compose.yml` files
- Multi-compose file support with intelligent merging
- Parent directory traversal for compose files
- Project structure detection and caching
- Service identification from compose configuration

#### Database Adapters
- **PostgreSQL Adapter** — Full support for PostgreSQL databases
  - Query execution via `psql`
  - Database backups via `pg_dump`
  - Database restoration via `pg_restore`
  - Status checking
- **Redis Adapter** — Full support for Redis databases
  - Command execution via `redis-cli`
  - Backup and restore operations
- **SQLite Adapter** — Full support for SQLite databases
  - Query execution
  - Database dump and restore
- **Extensible Adapter Pattern** — Easy to add new database types

#### Security Features
- Automatic secrets masking in environment variables
- Configurable secret keywords (`PASSWORD`, `TOKEN`, `KEY`, `SECRET`, `API_KEY`)
- Optional SQL validation to prevent dangerous operations
- Safe command execution via containers

#### Managers Layer
- **Container Manager** — Docker container operations
- **Compose Manager** — docker-compose operations
- **Environment Manager** — Environment variable management with secrets masking

#### Utilities
- Dockerode client wrapper
- Structured logging system
- Project discovery caching
- Compose exec helper

### Features

- **Type-Safe** — Written in TypeScript with full type definitions
- **Follow Logs** — Real-time log streaming with `follow` mode
- **Auto-Discovery** — Works with any Docker project automatically
- **Multi-Compose Support** — Handles multiple compose files intelligently
- **Environment File Support** — Reads `.env`, `.env.local`, etc.
- **Health Checks** — Container health status monitoring
- **Comprehensive Error Handling** — Clear error messages and diagnostics

### Documentation

- Complete API reference for all 15 commands
- Quick start guide for users
- Developer documentation with architecture details
- Real-world usage examples
- Troubleshooting guide
- FAQ section
- Database adapter creation guide

### Testing

- Unit tests for core components
- Integration tests for Docker operations
- End-to-end tests for MCP protocol compliance
- Test coverage reporting

### Technical Details

- **Node.js** >= 18.0.0 required
- **TypeScript** with strict mode
- **MCP SDK** for protocol implementation
- **Dockerode** for Docker API integration
- **Vitest** for testing

---

## Future Releases

### Planned for v1.1.0
- Additional database adapters (MySQL, MongoDB)
- Enhanced error messages
- Performance optimizations

### Planned for v2.0.0
- Docker Swarm support
- Kubernetes support
- Remote Docker host support
- Web UI for monitoring

---

**Note:** This is the initial stable release (1.0.0). All features listed above are production-ready and tested.

[1.0.0]: https://github.com/hypnosis/docker-mcp-server/releases/tag/v1.0.0

