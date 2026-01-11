# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-01-12

### Changed

#### 🏗️ Architecture - Profile-Based Docker Client Pool

- **Bug Fix (BUG-011)**: Fixed critical SSH client caching bug
  - **Problem**: Two profiles with same `host` but different SSH keys used ONE cached client
  - **Impact**: Wrong SSH key could be used, bypassing strict validation (v1.3.2)
  - **Solution**: Cache Docker clients by profile name instead of host
  - Each profile now guaranteed to use its own SSH client and key
  - Tunnels properly reused per profile, not per host

- **Internal Refactoring**: Migrated from host-based to profile-based client pool
  - Old: `getDockerClient(sshConfig)` — cached by host (bug)
  - New: `getDockerClientForProfile(profileName)` — cached by profile name (correct)
  - Managers now accept `profileName` instead of `sshConfig` in constructors
  - **No breaking changes for MCP tools users** — MCP API unchanged

#### Migration Guide

**For MCP users**: No changes required ✅

**For developers** (if using managers directly in custom code):

```typescript
// OLD (v1.3.x):
const sshConfig = resolveSSHConfig({ profile: 'prod' });
const manager = new ContainerManager(sshConfig);

// NEW (v1.4.0):
const manager = new ContainerManager('prod');
```

#### Technical Details

**Files changed:**
- `src/managers/container-manager.ts` — constructor accepts `profileName?`
- `src/managers/compose-manager.ts` — constructor accepts `profileName?`
- `src/utils/docker-client.ts` — removed old singleton, added profile pool
- `src/tools/*-tools.ts` — use `args.profile` directly
- `tests/unit/**/*.test.ts` — updated to new API

**Bug scenario (fixed):**
```json
{
  "profiles": {
    "prod-admin": { "host": "prod.com", "privateKeyPath": "~/.ssh/admin" },
    "prod-readonly": { "host": "prod.com", "privateKeyPath": "~/.ssh/readonly" }
  }
}
```

- Before: Both profiles used same cached client (first key wins) ❌
- After: Each profile has its own client ✅

---

## [1.3.2] - 2026-01-11

### Changed

#### 🔒 Security & Reliability - Strict SSH Key Validation

- **SSH Private Key Validation** — Strict validation for SSH private keys (fail-fast approach)
  - **Breaking Change**: If `privateKeyPath` is specified in profile, the file MUST exist
  - Previously: Silent fallback to SSH Agent / default keys if key not found (confusing behavior)
  - Now: Explicit error with actionable solutions if key file missing
  - Benefits:
    - ✅ Explicit authentication — you know exactly which key is used
    - ✅ Fail-fast — immediate error instead of silent fallback
    - ✅ Security — prevents accidental use of wrong SSH keys
    - ✅ Debuggability — clear error messages with solutions
  
- **SSH Agent Support** — Improved support for SSH Agent and default keys
  - If `privateKeyPath` NOT specified → uses SSH Agent or default keys (~/.ssh/id_rsa, ~/.ssh/id_ed25519)
  - Clear warning message when using SSH Agent / default keys
  - Explicit about authentication method being used

- **Legacy Fallback Mode** — Optional fallback via environment variable
  - Set `DOCKER_MCP_ALLOW_SSH_FALLBACK=true` to enable legacy behavior (not recommended)
  - Allows connection when key file missing (uses SSH Agent / default keys as fallback)
  - Warning message displayed when fallback is used

#### Migration Guide

If your connection breaks after upgrade:

**Option 1: Fix the path** (Recommended)
```json
{
  "privateKeyPath": "~/.ssh/id_ed25519_correct"  // Use correct path
}
```

**Option 2: Use SSH Agent**
```json
{
  "host": "...",
  "username": "...",
  // Remove privateKeyPath to use SSH Agent / default keys
}
```

**Option 3: Enable legacy fallback** (Temporary fix)
```bash
export DOCKER_MCP_ALLOW_SSH_FALLBACK=true
```

---

## [1.3.1] - 2026-01-10

### Fixed

#### 🔴 Critical Fix - Container Environment Variables
- **BUG-010: Environment Variables from Container** — Fixed database adapters reading environment variables from compose file instead of running container
  - Added `getContainerEnv()` method to `ContainerManager` to get env vars from Docker API (`container.inspect()`)
  - Database adapters now prioritize environment variables from running container over compose file
  - Fixes "role postgres does not exist" error when container was started with different compose file
  - All database operations (`query`, `backup`, `restore`, `status`) now use correct environment variables
  - Fallback to compose file if container environment unavailable (for backwards compatibility)

### Changed

- **Environment Variables Resolution** — Improved environment variable loading
  - `PostgreSQLAdapter`, `RedisAdapter`, `SQLiteAdapter` now get env vars from running container first
  - More reliable connection parameters when container started with different compose file
  - Better handling of test environments with different compose configurations

---

## [1.3.0] - 2026-01-10

### Fixed

#### 🔴 Critical Fixes - Remote Docker Support
- **BUG-003: SSH Profiles Application** — Fixed incorrect SSH profile application for remote Docker operations
  - Centralized profile resolution via `profile-resolver.ts`
  - Removed duplicate `getSSHConfigForProfile` methods from all tools
  - All tools now correctly use remote SSH connections when profile specified

- **BUG-004: Remote Commands Execution** — Fixed remote commands executing on local Docker instead of remote server
  - Fixed file-based profile loading from `DOCKER_PROFILES_FILE`
  - Profiles now correctly loaded from `~/.cursor/docker-profiles.json`
  - Priority: file → JSON string → fallback to local

- **BUG-005: Profile Info Display** — Fixed `docker_profile_info` not showing all profiles from configuration
  - Corrected profile loading from file system
  - All configured profiles now visible in `availableProfiles`

- **BUG-006: docker_env_list Remote Mode** — Fixed empty results when listing environment variables on remote Docker
  - Added `remote-compose.ts` utility for reading remote compose files via SSH
  - Environment variables now correctly parsed from remote `docker-compose.yml`
  - Secret masking works correctly in remote mode

- **BUG-007: Database Tools Remote Mode** — Fixed all database tools (`docker_db_*`) not working in remote mode
  - Added `projectConfig` parameter to all database adapter methods
  - Database adapters now receive project configuration from tools layer
  - All database operations (query, status, backup, restore) work in remote mode
  - Support for remote compose file reading in database operations

#### 🟡 Medium Fixes
- **BUG-008: pgvector Detection** — Fixed `ankane/pgvector:latest` not being detected as PostgreSQL
  - Added support for PostgreSQL extensions: pgvector, timescale, postgis, mariadb
  - Extended database type detection patterns in `compose-parser.ts` and `project-discovery.ts`

- **BUG-009: db_status Parsing** — Fixed `docker_db_status` returning dashes instead of real values
  - Fixed SQL result parsing in `PostgreSQLAdapter.status()`
  - Real values now returned for `size`, `connections`, `uptime`

### Added

- **Remote Compose File Reading** — New utility `src/utils/remote-compose.ts`
  - Reads `docker-compose.yml` files from remote servers via SSH
  - Supports both local and remote project discovery
  - Used by all tools that need compose configuration

- **Database Adapter Project Config** — Extended database adapter interface
  - Optional `projectConfig` parameter in all adapter methods
  - Allows tools to pass pre-resolved project configuration
  - Eliminates redundant project discovery calls in adapters

- **Enhanced Database Type Detection** — Extended PostgreSQL pattern matching
  - Support for `pgvector`, `timescale`, `postgis` images
  - MariaDB detection as MySQL-compatible
  - Better image pattern matching

- **Code Cleanup for Release** — Removed debug logging from production code
  - Removed all logger calls from `compose-parser.ts` (parse, parseFromString, detectServiceType)
  - Removed debug comments from `index.ts`
  - Cleaner production code without debug noise

### Changed

- **Profile Resolution Architecture** — Centralized profile management
  - Single source of truth: `profile-resolver.ts`
  - All tools use unified `resolveSSHConfig()` function
  - Removed code duplication across 4+ tool files

- **Database Tools Architecture** — Improved dependency injection
  - Database adapters receive project config from tools layer
  - Tools handle project discovery once, pass to adapters
  - Better separation of concerns

### Testing

- **Comprehensive Remote Testing** — All 20 tools tested in remote mode
  - 100% tool coverage in remote environment
  - All critical bugs verified as fixed
  - Dangerous operations (start/stop/restart/up/down/restore) tested safely

- **Comprehensive Local Testing** — All 20 tools tested in local mode
  - 100% tool coverage in local environment
  - Parallel testing confirms both modes work identically

### Documentation

- **Updated MCP_BUGS.md** — Complete bug fix documentation
  - All 9 bugs documented with fix details
  - Testing results and verification included
  - Ready for reference

---

## [1.2.1] - 2026-01-09

### Added

- **Comprehensive Testing System** — Complete E2E testing framework
  - 32 E2E tests covering all 20 MCP commands
  - Isolated test categories for fast debugging (9 categories)
  - Test environment with docker-compose.test.yml (web, postgres, redis)
  - Pre-commit script for automated testing before commits
  - Manual testing checklist for AI assistants
  - Testing documentation unified in `docs/testing/`

- **Auto-detection of working_dir** — Executor tool improvements
  - `docker_exec` now automatically detects `working_dir` from docker-compose.yml
  - No need to specify `workdir` if configured in compose file
  - Backward compatible (explicit `workdir` still works)

### Fixed

- **docker_container_list** — Fixed REST API behavior
  - Without `project` parameter: now shows ALL containers with Compose labels (grouped by project)
  - With `project` parameter: shows containers for specific project only
  - Previously always auto-detected project from current directory, causing empty results

- **package-lock.json** — Synchronized version (1.2.1) and name (@hypnosis/docker-mcp-server)

### Changed

- **docker_discover_projects** → **docker_projects** — Renamed for clarity
  - Works for both local and remote Docker
  - Uses Docker Compose labels for fast discovery (~2s)
  - Shows project status (running/partial/stopped)

- **docker_project_status** — Removed
  - Functionality replaced by `docker_container_list({project: "name"})`
  - Reduces API surface, follows REST principles

- **Testing Documentation** — Unified and organized
  - All testing docs moved to `docs/testing/`
  - Single entry point: `docs/testing/README.md`
  - Deprecated docs moved to `docs/testing/deprecated/`
  - Archive moved to `docs/testing/archive/`

### Improved

- **REST API Approach** — Simplified and more intuitive
  - `docker_projects()` → list all projects
  - `docker_container_list()` → list all containers (grouped by project)
  - `docker_container_list({project: "x"})` → list containers for project x
  - Clearer semantics, better UX

- **Project Structure** — Cleaned up root directory
  - Removed temporary test-*.js scripts
  - Organized documentation structure
  - Updated .gitignore to prevent future clutter

---

## [1.2.0] - 2026-01-09

### Added

- **Profile Parameter** — Parallel access to LOCAL and REMOTE Docker environments
  - Optional `profile` parameter in all commands for specifying target environment
  - Default behavior: LOCAL Docker (when profile not specified)
  - Support for `"local"` profile in `profiles.json` for explicit local mode
  - Docker client pool for efficient connection management
  - Lazy SSH tunnel creation (only when accessing remote profiles)
  - Parallel usage: work with both LOCAL and REMOTE in the same session

- **Profile-based Client Pool** — Efficient Docker client management
  - `getDockerClientForProfile(profile?: string)` — Get client for specific profile
  - Automatic caching of Docker clients per profile
  - Graceful cleanup of all clients on shutdown
  - Support for multiple concurrent connections

### Changed

- **All Commands** — Now support optional `profile` parameter
  - Container commands: `docker_container_list`, `docker_container_start/stop/restart`, `docker_container_logs`, `docker_container_stats`, `docker_compose_up/down`, `docker_resource_list`
  - Database commands: `docker_db_query`, `docker_db_backup`, `docker_db_restore`, `docker_db_status`
  - Executor: `docker_exec`
  - Environment commands: `docker_env_list`, `docker_compose_config`, `docker_healthcheck`
  - Discovery commands: `docker_discover_projects`, `docker_project_status`

- **Profiles Format** — Extended to support local mode
  - Added `mode: "local" | "remote"` field in profile configuration
  - `host` and `username` are now optional (required only for remote profiles)
  - Example: `{"local": {"mode": "local"}}` for local Docker

### Improved

- **User Experience** — No need to restart MCP server to switch between environments
  - Quick switching between local testing and remote deployment
  - Parallel comparison of environments in single session
  - Better workflow for development → staging → production

---

## [1.1.0] - 2026-01-09

### Added

- **Remote Docker Support** — Full SSH-based remote Docker management
  - SSH tunnel creation and management for remote Docker connections
  - Multiple server profiles support via `profiles.json` file
  - Automatic retry logic with exponential backoff (3 attempts, 30s timeout)
  - Healthcheck for SSH tunnel with automatic reconnection
  - Secure credential management (SSH keys, passwords)

- **Remote Project Discovery** — Automatic discovery of Docker projects on remote servers
  - `docker_discover_projects` — Fast discovery of all projects using Docker labels (~2s)
  - `docker_project_status` — Detailed status for specific project with compose config (~3s)
  - Automatic project status detection (running, partial, stopped)
  - Issues detection (restarting, unhealthy, exited containers)
  - REST API-like approach: fast list + detailed status

- **Project Parameter** — Explicit project specification for all commands
  - All commands now support optional `project` parameter
  - Works seamlessly with both local and remote Docker
  - Backward compatible (auto-detect for local projects)

- **SSH File Access** — Read docker-compose.yml files via SSH
  - `execSSH()` — Execute commands on remote server via SSH
  - `readRemoteFile()` — Read files from remote server
  - `findRemoteFiles()` — Find files on remote server

- **Profile Management** — Multiple server configuration
  - `docker_profile_list` — List all available SSH profiles
  - `docker_profile_switch` — Switch between server profiles
  - Support for `projectsPath` in profile configuration
  - Default profile selection

### Changed

- **Command Count** — Increased from 18 to 23 commands
  - Added 2 discovery commands (`docker_discover_projects`, `docker_project_status`)
  - Added 2 profile commands (`docker_profile_list`, `docker_profile_switch`)
  - Added 1 health command (`docker_mcp_health`)

- **Performance Optimization** — Remote Discovery improvements
  - Fast mode always enabled for `discoverProjects()` (Docker labels only, ~2s)
  - Full mode for `getProjectStatus()` (reads compose for specific project, ~3s)
  - Optimized batch `docker inspect` via SSH (single command instead of multiple)
  - Fixed Node.js process hanging issue (unref for healthcheck interval)

- **Docker Client** — Enhanced with SSH support
  - SSH tunnel creation and management
  - Automatic tunnel healthcheck
  - Cleanup on shutdown
  - Retry logic for network operations

### Fixed

- **Process Hanging** — Fixed Node.js process hanging after SSH tunnel creation
  - Added `unref()` for healthcheck interval to allow process exit
  - Proper cleanup of SSH processes and timers

- **Remote Container Status** — Fixed incorrect status detection for remote containers
  - Corrected Docker API connection to use SSH tunnel
  - Fixed container matching with services via Docker labels

### Documentation

- Added `docs/REMOTE_DOCKER.md` — Complete guide for remote Docker setup
- Added `docs/REMOTE_DISCOVERY.md` — Remote project discovery documentation
- Added `TEST_COMPARISON.md` — Comparative analysis of MCP vs SSH commands
- Updated `docs/API_REFERENCE.md` — Added new discovery and profile commands
- Updated `docs/sprints/SPRINT_5_REMOTE_DOCKER.md` — Sprint completion details

### Testing

- Added 46 new tests for remote Docker functionality
  - Unit tests for DockerClient with SSH (21 tests)
  - Unit tests for ProfileTool (13 tests)
  - Integration tests for remote Docker (12 tests)
- All 178 tests passing
- Comparative testing: MCP vs SSH (MCP scores 29/30 vs SSH 13/30)

---

## [1.0.4] - 2026-01-02

### Added

- **Resource Monitoring** — New commands for monitoring Docker resources
  - `docker_container_stats` — Get real-time container resource usage (CPU, Memory, Network, Block I/O)
  - `docker_resource_list` — Universal command to list Docker images, volumes, or networks
  - Provides comprehensive metrics for container performance monitoring
  - Supports filtering by resource type (images, volumes, networks)

### Changed

- **Command Count** — Increased from 16 to 18 commands
  - Optimized command structure to stay within Cursor MCP limits
  - Used universal `docker_resource_list` instead of 3 separate commands

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

### Planned for v1.2.0
- Additional database adapters (MySQL, MongoDB)
- Enhanced error messages
- Performance optimizations (caching for discovery)

### Planned for v2.0.0
- Docker Swarm support
- Kubernetes support
- Web UI for monitoring

---

**Note:** This is the initial stable release (1.0.0). All features listed above are production-ready and tested.

[1.0.0]: https://github.com/hypnosis/docker-mcp-server/releases/tag/v1.0.0

