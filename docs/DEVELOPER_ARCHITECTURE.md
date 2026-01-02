# Developer Architecture

> Detailed technical architecture of Docker MCP Server for developers

**Version:** 1.0  
**Updated:** 2025-01-XX

---

## 🎯 Overview

This document describes the internal architecture of the project for developers who will implement or extend functionality.

---

## 📦 Technology Stack

```
┌─────────────────────────────────────────────────────┐
│  TECH STACK                                         │
├─────────────────────────────────────────────────────┤
│  Runtime:        Node.js 18+                       │
│  Language:       TypeScript 5+                     │
│  MCP Protocol:   @modelcontextprotocol/sdk ^0.6.0  │
│  Docker API:     dockerode ^4.0.2                  │
│  YAML Parser:    yaml ^2.3.4                       │
│  Env Parser:     dotenv ^16.4.5                    │
│  Test Runner:    Jest/Vitest (Sprint 3)            │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP SERVER LAYER                         │
│  (src/index.ts)                                             │
│  • Tool registration                                        │
│  • JSON-RPC handling                                       │
│  • STDIO transport                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    PROJECT DISCOVERY                        │
│  (src/discovery/)                                           │
│  • Finding docker-compose.yml                              │
│  • Multi-compose support                                   │
│  • YAML parsing                                            │
│  • Service type detection                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    DOCKERODE CLIENT                         │
│  (src/utils/docker-client.ts)                               │
│  • Docker API initialization                               │
│  • Connection management                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  CONTAINER   │ │  DATABASE    │ │ ENVIRONMENT  │
│  MANAGER     │ │  ADAPTERS    │ │  MANAGER     │
└──────────────┘ └──────────────┘ └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYER                           │
│  (src/security/)                                            │
│  • Secrets masking                                         │
│  • SQL validation (optional)                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    MCP TOOLS                                │
│  (src/tools/)                                               │
│  • 7 container commands                                    │
│  • 4 database commands                                      │
│  • 3 environment commands                                   │
│  • 1 universal executor                                     │
│  • 1 MCP health tool                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
docker-mcp-server/
├── src/
│   ├── index.ts                          # MCP server entry point
│   │
│   ├── discovery/                        # 🔍 Project Discovery
│   │   ├── project-discovery.ts          #   Main discovery class
│   │   ├── compose-parser.ts             #   YAML parsing
│   │   ├── config-merger.ts              #   Config merging
│   │   └── types.ts                      #   ProjectConfig, ServiceConfig
│   │
│   ├── adapters/                         # 🔌 Database Adapters
│   │   ├── database-adapter.ts           #   Interface
│   │   ├── adapter-registry.ts           #   Adapter factory
│   │   ├── postgresql.ts                 #   PostgreSQL adapter
│   │   ├── redis.ts                      #   Redis adapter
│   │   └── sqlite.ts                     #   SQLite adapter
│   │
│   ├── managers/                         # 🎛️ Managers
│   │   ├── container-manager.ts          #   Docker containers
│   │   ├── compose-manager.ts            #   docker-compose
│   │   └── env-manager.ts                #   Environment vars
│   │
│   ├── security/                         # 🔒 Security
│   │   ├── secrets-masker.ts             #   Secrets masking
│   │   └── sql-validator.ts              #   SQL validation
│   │
│   ├── tools/                            # 🛠️ MCP Tools
│   │   ├── container-tools.ts            #   7 container commands
│   │   ├── database-tools.ts             #   4 database commands
│   │   ├── env-tools.ts                  #   3 environment commands
│   │   ├── executor-tool.ts              #   1 universal command
│   │   └── mcp-health-tool.ts           #   1 MCP health command
│   │
│   └── cli.ts                            # 💻 CLI Interface
│   │
│   └── utils/                            # 🔧 Utilities
│       ├── docker-client.ts              #   Dockerode client
│       ├── logger.ts                     #   Logging (stderr)
│       └── cache.ts                      #   Caching
│
├── tests/
│   ├── unit/                             # Unit tests
│   ├── integration/                      # Integration tests
│   └── e2e/                              # E2E tests
│
└── docs/                                 # Documentation
```

---

## 🔍 Key Components

### 1. Project Discovery

**Purpose:** Automatic detection and parsing of docker-compose.yml

**Main class:** `ProjectDiscovery`

**Main methods:**
```typescript
class ProjectDiscovery {
  // Find project with options
  async findProject(options: DiscoveryOptions): Promise<ProjectConfig>
  
  // Auto-detect compose files
  private autoDetectFiles(cwd: string, env?: string): string[]
  
  // Merge configs
  private mergeConfigs(files: string[]): ProjectConfig
  
  // Parse YAML
  private parseYaml(file: string): any
}
```

**Discovery process:**
```
1. If explicitPath → use it
2. Otherwise search recursively:
   a. docker-compose.yml (base)
   b. docker-compose.{env}.yml (environment)
   c. docker-compose.override.yml (local)
3. Merge all files (deep merge)
4. Detect service types
5. Cache result (60 seconds)
```

**Caching:**
- TTL: 60 seconds
- Key: absolute path to compose file
- Invalidation: by TTL or on error

---

### 2. Dockerode Client

**Purpose:** Connection to Docker API

**Main class:** `DockerClient` (wrapper over Dockerode)

**Initialization:**
```typescript
import Docker from 'dockerode';

const docker = new Docker();
// Automatically connects to:
// - Mac/Windows: Docker Desktop socket
// - Linux: /var/run/docker.sock

// Check connection
await docker.ping();
```

**Main operations:**
```typescript
// Containers
const containers = await docker.listContainers({all: true});
const container = docker.getContainer(containerId);
await container.start();
await container.stop();
const logs = await container.logs({follow: true, stdout: true});

// Exec
const exec = await container.exec({
  Cmd: ['npm', 'test'],
  AttachStdout: true,
  AttachStderr: true
});
```

---

### 3. Container Manager

**Purpose:** Docker container management

**Main class:** `ContainerManager`

**Main methods:**
```typescript
class ContainerManager {
  constructor(private docker: Docker) {}
  
  async listContainers(projectName: string): Promise<Container[]>
  async startContainer(serviceName: string, projectName: string): Promise<void>
  async stopContainer(serviceName: string, projectName: string): Promise<void>
  async restartContainer(serviceName: string, projectName: string): Promise<void>
  async getLogs(serviceName: string, options: LogOptions): Promise<string | Stream>
}
```

**Container discovery:**
- Name format: `{projectName}_{serviceName}_{index}`
- Use `docker.listContainers()` with project name filter
- Map service name → container name

---

### 4. Database Adapters

**Purpose:** Abstraction for working with different databases

**Interface:**
```typescript
interface DatabaseAdapter {
  query(service: string, query: string, options?: QueryOptions): Promise<string>;
  backup(service: string, options: BackupOptions): Promise<string>;
  restore(service: string, backupPath: string, options?: RestoreOptions): Promise<void>;
  status(service: string): Promise<DBStatus>;
  getConnectionInfo(service: ServiceConfig, env: Record<string, string>): ConnectionInfo;
}
```

**Adapter Registry:**
```typescript
class AdapterRegistry {
  private adapters = new Map<string, DatabaseAdapter>();
  
  register(type: string, adapter: DatabaseAdapter): void
  get(serviceType: string): DatabaseAdapter
}
```

**Database type detection:**
```typescript
// By image name in docker-compose.yml
if (image.includes('postgres')) return 'postgresql';
if (image.includes('redis')) return 'redis';
if (image.includes('sqlite')) return 'sqlite';
```

**Connection Info:**
- Read from environment variables (`.env` or `docker-compose.yml`)
- PostgreSQL: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Redis: `REDIS_PASSWORD` (optional)
- SQLite: `SQLITE_DATABASE` (file path)

---

### 5. Environment Manager

**Purpose:** Environment variable management

**Main class:** `EnvManager`

**Process:**
```
1. Read .env files (in priority order):
   a. .env (base)
   b. .env.local (local overrides)
   c. .env.{NODE_ENV} (environment-specific)
2. Read env from docker-compose.yml
3. Merge everything together
4. Mask secrets (if needed)
```

**Secrets Masking:**
- Keywords: `PASSWORD`, `TOKEN`, `KEY`, `SECRET`, `API_KEY`, `PRIVATE`, `CREDENTIALS`
- Case-insensitive search
- Replace value with `***MASKED***`
- Can be disabled via option

---

### 6. MCP Tools

**Purpose:** Registration of MCP commands for AI assistant

**Registration:**
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'docker_container_list',
      description: 'List all containers in the project',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          all: { type: 'boolean', default: true }
        }
      }
    },
    // ... other tools
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'docker_container_list':
      return await containerTools.list(args);
    // ... other cases
  }
});
```

**Error handling:**
```typescript
try {
  const result = await manager.listContainers(projectName);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
} catch (error) {
  return {
    content: [{ 
      type: 'text', 
      text: `Error: ${error.message}` 
    }],
    isError: true
  };
}
```

---

## 🔄 Data Flow

### Example: docker_container_list

```
1. USER: "Show me all containers"
   ↓
2. CURSOR (AI): Calls docker_container_list()
   ↓
3. MCP SERVER: Receives JSON-RPC request
   ↓
4. container-tools.ts: Processes request
   ↓
5. ProjectDiscovery: Finds project
   ↓
6. ContainerManager: Gets container list
   ↓
7. Dockerode: docker.listContainers()
   ↓
8. Docker Engine: Returns container list
   ↓
9. ContainerManager: Filters by project name
   ↓
10. container-tools.ts: Formats result
   ↓
11. MCP SERVER: Returns JSON-RPC response
   ↓
12. CURSOR (AI): Shows list to user
```

### Example: docker_db_query

```
1. USER: "Query postgres: SELECT * FROM users"
   ↓
2. CURSOR (AI): Calls docker_db_query("postgres", "SELECT * FROM users")
   ↓
3. MCP SERVER: Receives request
   ↓
4. database-tools.ts: Processes request
   ↓
5. ProjectDiscovery: Finds project, detects database type
   ↓
6. AdapterRegistry: Gets PostgreSQLAdapter
   ↓
7. PostgreSQLAdapter: Builds psql command
   ↓
8. EnvManager: Gets credentials
   ↓
9. docker_exec: Executes psql command in container
   ↓
10. PostgreSQL Container: Executes SQL
   ↓
11. PostgreSQLAdapter: Returns result
   ↓
12. database-tools.ts: Formats result
   ↓
13. MCP SERVER: Returns JSON-RPC response
   ↓
14. CURSOR (AI): Shows user table
```

---

## 🔒 Security

### Secrets Masking

**Where applied:**
- `docker_env_list()` - automatically
- All commands returning environment variables

**Keywords:**
```typescript
const SECRET_KEYWORDS = [
  'PASSWORD',
  'TOKEN',
  'KEY',
  'SECRET',
  'API_KEY',
  'PRIVATE',
  'CREDENTIALS'
];
```

**Algorithm:**
```typescript
function maskSecrets(env: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(env)) {
    if (isSecret(key)) {
      masked[key] = '***MASKED***';
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}
```

### SQL Validation (optional)

**Enable:**
```typescript
process.env.DOCKER_MCP_VALIDATE_SQL === 'true'
```

**Patterns:**
- `DROP DATABASE`
- `DELETE FROM table` (without WHERE)
- `TRUNCATE TABLE`
- `DROP TABLE`

**Usage:**
```typescript
if (process.env.DOCKER_MCP_VALIDATE_SQL === 'true') {
  sqlValidator.validate(sql);
}
```

---

## 🧪 Testing

### Unit Tests

**Approach:** Mocks for isolation

**Example:**
```typescript
// tests/unit/managers/container-manager.test.ts
describe('ContainerManager', () => {
  let docker: jest.Mocked<Docker>;
  let manager: ContainerManager;
  
  beforeEach(() => {
    docker = createMockDocker();
    manager = new ContainerManager(docker);
  });
  
  it('should list containers', async () => {
    docker.listContainers.mockResolvedValue([
      { Id: '123', Names: ['my-project_web_1'], Status: 'running' }
    ]);
    
    const containers = await manager.listContainers('my-project');
    expect(containers).toHaveLength(1);
  });
});
```

### Integration Tests

**Approach:** Real Docker (requires running Docker)

**Example:**
```typescript
// tests/integration/container-workflow.test.ts
describe('Container Workflow', () => {
  beforeAll(async () => {
    // Start test containers
    await exec('docker-compose -f docker-compose.test.yml up -d');
  });
  
  afterAll(async () => {
    await exec('docker-compose -f docker-compose.test.yml down');
  });
  
  it('should list containers', async () => {
    const manager = new ContainerManager(docker);
    const containers = await manager.listContainers('test-project');
    expect(containers.length).toBeGreaterThan(0);
  });
});
```

---

## 📊 Performance

### Caching

**Where we cache:**
- ProjectConfig (60 seconds)
- Environment variables (60 seconds)

**Invalidation:**
- By TTL
- On error

### Optimizations

- **Dockerode vs CLI:** Dockerode is faster (8-10x) thanks to direct API
- **Lazy loading:** Adapters loaded only when needed
- **Streaming:** Logs and exec use streams for large data

---

## 🐛 Error Handling

### Error Types

1. **Docker not running**
   ```typescript
   Error: Docker is not running. Please start Docker Desktop.
   ```

2. **docker-compose.yml not found**
   ```typescript
   Error: docker-compose.yml not found. Please run from project directory.
   ```

3. **Container not found**
   ```typescript
   Error: Container 'web' not found in project 'my-project'
   ```

4. **Database connection failed**
   ```typescript
   Error: Failed to connect to PostgreSQL: password incorrect
   ```

### Error Handling Pattern

```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', error);
  throw new Error(`Human-readable message: ${error.message}`);
}
```

---

## 🔗 Module Dependencies

```
index.ts
  ├── tools/container-tools.ts
  │     ├── managers/container-manager.ts
  │     │     └── utils/docker-client.ts
  │     └── discovery/project-discovery.ts
  │
  ├── tools/database-tools.ts
  │     ├── adapters/adapter-registry.ts
  │     │     └── adapters/{postgresql,redis,sqlite}.ts
  │     ├── discovery/project-discovery.ts
  │     └── managers/env-manager.ts
  │
  └── tools/env-tools.ts
        ├── managers/env-manager.ts
        │     └── security/secrets-masker.ts
        └── discovery/project-discovery.ts
```

---

## 📝 Best Practices

### Code

1. **TypeScript strict mode** - use everywhere
2. **Error handling** - always try/catch with clear errors
3. **Logging** - use logger, not console.log
4. **Async/await** - prefer over Promise chains

### Architecture

1. **Separation of concerns** - each module responsible for one thing
2. **Dependency injection** - pass dependencies through constructor
3. **Interface over implementation** - use interfaces (DatabaseAdapter)
4. **Fail fast** - validate input data immediately

### Testing

1. **Unit tests** - isolate with mocks
2. **Integration tests** - test real workflows
3. **E2E tests** - test critical paths
4. **Coverage** - aim for 80%+

---

## 🔗 Related Documents

- [Development Plan](./sprints/SPRINTS.md)
- [API Reference](./API_REFERENCE.md)
- [Database Adapters](./DATABASE_ADAPTERS.md)

---

**Updated:** 2025-01-XX  
**Version:** 1.0
