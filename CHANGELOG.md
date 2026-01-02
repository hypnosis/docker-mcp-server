# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.3] - 2026-01-02

### Changed

- **Dynamic Version Detection** — Server version now automatically reads from `package.json`
  - Version in logs and MCP server info now matches package.json version
  - No need to manually update version in code

- **Improved Error Messages** — Enhanced error messages for better user experience
  - Added helpful suggestions when docker-compose.yml is not found
  - Lists supported compose file names
  - Provides actionable guidance

### Fixed

- **Server Version** — MCP server now reports correct version from package.json instead of hardcoded value

---

## [1.0.2] - 2026-01-02

### Fixed

- **Workspace Root Detection** — MCP server now correctly finds `docker-compose.yml` in workspace directory
  - Added workspace root detection via MCP `roots/list` protocol
  - Fixed `docker-compose.yml` discovery to use workspace root from MCP client instead of `process.cwd()`
  - Improved error messages to indicate workspace root source

- **Port Conflict Detection** — Automatic detection and helpful error messages for port conflicts
  - Added `port-utils.ts` with functions to find containers by port
  - Enhanced error handling in `compose-manager.ts` to detect port conflicts
  - Error messages now show which container is using the conflicting port
  - Improved error message extraction from docker-compose stderr/stdout

- **Command Routing** — Fixed `docker_compose_config` command routing
  - Fixed bug where `docker_compose_config` was incorrectly routed to `containerTools` instead of `envTools`
  - Changed routing order to check `envTools` before `docker_compose_` prefix check
  - All 16 commands now work correctly

### Added

- **Workspace Manager** (`src/utils/workspace.ts`) — Centralized workspace root management
  - Stores workspace root obtained from MCP client via `listRoots()`
  - Provides fallback to `process.cwd()` if workspace root not available
  - Used by `ProjectDiscovery` for automatic compose file detection

- **Port Utilities** (`src/utils/port-utils.ts`) — Utilities for port conflict detection
  - `findContainerByPort()` — Find container using specific port
  - `extractPortFromError()` — Extract port number from Docker error messages
  - `stopContainerById()` — Helper to stop conflicting containers

### Changed

- **Error Handling** — Improved error messages throughout
  - Better error message extraction from docker-compose commands (includes stderr/stdout)
  - Port conflict errors now include container name, ID, and status
  - Suggestions for resolving port conflicts

- **Project Discovery** — Enhanced to use workspace root
  - Uses MCP workspace root when available
  - Falls back to `process.cwd()` if workspace root not available
  - Improved error messages to indicate workspace root source

### Testing

- Complete stress testing of all 16 commands
- Tested workspace root detection with Cursor
- Tested port conflict detection with real conflicts
- Tested error handling when Docker Desktop is not running
- All commands tested and verified working (100% coverage)

---

## [1.0.0] - 2026-01-02

### Added

#### Core Features
- **16 MCP Commands** for Docker container management
  - Container Management (7): `docker_container_list`, `docker_container_start`, `docker_container_stop`, `docker_container_restart`, `docker_container_logs`, `docker_compose_up`, `docker_compose_down`
  - Database Operations (4): `docker_db_query`, `docker_db_backup`, `docker_db_restore`, `docker_db_status`
  - Environment & Config (3): `docker_env_list`, `docker_compose_config`, `docker_healthcheck`
  - Universal Executor (1): `docker_exec`
  - MCP Health (1): `docker_mcp_health`

#### CLI Interface
- **Command-Line Interface** (`docker-mcp-server-cli`) for direct command execution
  - All MCP commands available via CLI
  - Direct execution outside of MCP clients
  - Same three-level fallback strategy for container discovery

#### Container Discovery
- **Three-Level Fallback Strategy** for reliable container discovery
  1. Docker Compose Labels (Priority) - Direct Docker API call using `com.docker.compose.project` label
  2. docker-compose ps CLI (Fallback 1) - For older docker-compose versions
  3. Name-based filter (Fallback 2) - Filter by project name in container names

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

- Complete API reference for all 16 commands
- CLI interface documentation
- Container discovery strategy documentation
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

