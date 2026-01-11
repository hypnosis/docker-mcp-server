# Architecture

> System design and technical decisions for Docker MCP Server

## 🎯 Design Principles

### 1. Universality
- **Works with any Docker project** — No hardcoded container names or project-specific logic
- **Auto-discovery** — Automatically finds and parses project structure
- **Zero configuration** — Works out of the box with sensible defaults

### 2. Extensibility
- **Plugin architecture** — Easy to add new database adapters
- **Universal executor** — `docker_exec` provides unlimited extensibility
- **Modular design** — Each component is independent and testable

### 3. Minimalism
- **16 essential commands** — Covers 95% of use cases
- **No duplication** — Complex scenarios handled through `docker_exec`
- **Clean API** — Intuitive naming and consistent parameters
- **CLI Interface** — Direct command execution outside MCP clients

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP CLIENT (Cursor/Claude)                     │
│                         (AI Assistant)                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ MCP Protocol (STDIO)
                             │ JSON-RPC 2.0
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   docker-mcp-server (Node.js)                       │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │               PROJECT DISCOVERY LAYER                      │   │
│  │  • Finds docker-compose.yml (recursive search)             │   │
│  │  • Parses YAML structure                                   │   │
│  │  • Detects service types (web, db, cache)                  │   │
│  │  • Loads environment files (.env, .env.local)              │   │
│  │  • Determines project name and context                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                             ↓                                       │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │   CONTAINER     │  │   DATABASE   │  │   ENVIRONMENT    │     │
│  │   MANAGER       │  │   ADAPTER    │  │   MANAGER        │     │
│  ├─────────────────┤  ├──────────────┤  ├──────────────────┤     │
│  │ • list          │  │ PostgreSQL   │  │ • read .env      │     │
│  │ • start/stop    │  │ Redis        │  │ • read compose   │     │
│  │ • restart       │  │ SQLite       │  │ • mask secrets   │     │
│  │ • logs          │  │ MySQL        │  │ • validate       │     │
│  │ • build         │  │ MongoDB      │  │                  │     │
│  └─────────────────┘  └──────────────┘  └──────────────────┘     │
│                             │                                       │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │               SECURITY LAYER                                │   │
│  │  • Secrets masking (PASSWORD, TOKEN, KEY, etc.)            │   │
│  │  • SQL validation (optional)                               │   │
│  │  • Path validation (prevent directory traversal)           │   │
│  └────────────────────────────────────────────────────────────┘   │
│                             │                                       │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │               UNIVERSAL EXECUTOR                            │   │
│  │  docker_exec(service, command) — executes ANYTHING         │   │
│  └────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Docker API / CLI
                             │ docker exec, docker-compose
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          DOCKER ENGINE                              │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│  │   Service 1    │  │   Service 2    │  │   Service N    │       │
│  │   (web/api)    │  │   (database)   │  │   (cache)      │       │
│  │                │  │                │  │                │       │
│  │ • Application  │  │ • PostgreSQL   │  │ • Redis        │       │
│  │ • Tests        │  │ • Migrations   │  │ • Queue        │       │
│  │ • CLI tools    │  │ • Backups      │  │ • Sessions     │       │
│  └────────────────┘  └────────────────┘  └────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Project Discovery Layer

### How It Works

```typescript
class ProjectDiscovery {
  /**
   * Step 1: Find docker-compose.yml
   * Searches current directory and parent directories
   */
  findComposeFile(cwd: string): string {
    const candidates = [
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml'
    ];
    
    let currentDir = cwd;
    while (currentDir !== '/') {
      for (const filename of candidates) {
        const path = join(currentDir, filename);
        if (existsSync(path)) return path;
      }
      currentDir = dirname(currentDir);
    }
    
    throw new Error('docker-compose.yml not found');
  }
  
  /**
   * Step 2: Parse project structure
   */
  parseProject(composeFile: string): ProjectConfig {
    const yaml = readFileSync(composeFile, 'utf-8');
    const config = parse(yaml);
    
    return {
      name: this.getProjectName(composeFile, config),
      services: this.parseServices(config.services),
      networks: config.networks || {},
      volumes: config.volumes || {},
      envFiles: this.findEnvFiles(dirname(composeFile))
    };
  }
  
  /**
   * Step 3: Detect service types
   */
  detectServiceType(service: ServiceConfig): ServiceType {
    const image = service.image?.toLowerCase() || '';
    
    if (image.includes('postgres')) return 'postgresql';
    if (image.includes('redis')) return 'redis';
    if (image.includes('mysql')) return 'mysql';
    if (image.includes('mongo')) return 'mongodb';
    if (image.includes('sqlite')) return 'sqlite';
    
    return 'generic';
  }
  
  /**
   * Step 4: Load environment files
   */
  loadEnvFiles(projectDir: string): Record<string, string> {
    const envFiles = ['.env', '.env.local', '.env.development'];
    const env: Record<string, string> = {};
    
    for (const file of envFiles) {
      const path = join(projectDir, file);
      if (existsSync(path)) {
        Object.assign(env, dotenv.parse(readFileSync(path)));
      }
    }
    
    return this.maskSecrets(env);
  }
}
```

### Example: Auto-Discovery in Action

```typescript
// User's working directory: /path/to/my-project/src/
// MCP Server automatically:

1. Searches for docker-compose.yml:
   /path/to/my-project/src/docker-compose.yml ❌
   /path/to/my-project/docker-compose.yml ✅ FOUND

2. Parses structure:
   Project name: my-project
   Services:
     - web (Node.js)
     - postgres (PostgreSQL)
     - redis (Redis)

3. Loads environment:
   .env → DATABASE_URL, REDIS_URL, API_KEY (masked)

4. Ready to use:
   docker_container_list() → Shows: web, postgres, redis
   docker_db_query("postgres", "SELECT 1") → Auto-connects with credentials
```

---

## 🔌 Database Adapter Pattern

### Interface

```typescript
interface DatabaseAdapter {
  /**
   * Execute a query/command
   */
  query(service: string, sql: string, options?: QueryOptions): Promise<string>;
  
  /**
   * Create a backup
   */
  backup(service: string, options: BackupOptions): Promise<string>;
  
  /**
   * Restore from backup
   */
  restore(service: string, backupPath: string, options?: RestoreOptions): Promise<void>;
  
  /**
   * Get database status
   */
  status(service: string): Promise<DBStatus>;
  
  /**
   * Get connection info from environment
   */
  getConnectionInfo(service: ServiceConfig, env: Record<string, string>): ConnectionInfo;
}
```

### PostgreSQL Adapter

```typescript
class PostgreSQLAdapter implements DatabaseAdapter {
  async query(service: string, sql: string, options?: QueryOptions): Promise<string> {
    const conn = this.getConnectionInfo(service);
    const command = `psql -U ${conn.user} -d ${conn.database} -c "${sql}"`;
    return dockerExec(service, command);
  }
  
  async backup(service: string, options: BackupOptions): Promise<string> {
    const conn = this.getConnectionInfo(service);
    const format = options.format || 'custom';
    const output = options.output || `./backup-${Date.now()}.dump`;
    
    const command = `pg_dump -U ${conn.user} -d ${conn.database} -F ${format} -f ${output}`;
    await dockerExec(service, command);
    
    return output;
  }
  
  async restore(service: string, backupPath: string): Promise<void> {
    const conn = this.getConnectionInfo(service);
    const command = `pg_restore -U ${conn.user} -d ${conn.database} ${backupPath}`;
    await dockerExec(service, command);
  }
  
  async status(service: string): Promise<DBStatus> {
    const version = await this.query(service, 'SELECT version()');
    const size = await this.query(service, 
      "SELECT pg_size_pretty(pg_database_size(current_database()))");
    const connections = await this.query(service,
      'SELECT count(*) FROM pg_stat_activity');
    
    return { version, size, connections };
  }
  
  getConnectionInfo(service: ServiceConfig): ConnectionInfo {
    // Parse from environment or compose config
    return {
      host: 'localhost',
      port: 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'postgres'
    };
  }
}
```

### Redis Adapter

```typescript
class RedisAdapter implements DatabaseAdapter {
  async query(service: string, command: string): Promise<string> {
    return dockerExec(service, `redis-cli ${command}`);
  }
  
  async backup(service: string, options: BackupOptions): Promise<string> {
    // Redis SAVE or BGSAVE
    await this.query(service, 'SAVE');
    
    // Copy dump.rdb from container
    const output = options.output || `./redis-backup-${Date.now()}.rdb`;
    await dockerExec(service, `cp /data/dump.rdb ${output}`);
    
    return output;
  }
  
  async status(service: string): Promise<DBStatus> {
    const info = await this.query(service, 'INFO');
    return this.parseRedisInfo(info);
  }
}
```

### SQLite Adapter

```typescript
class SQLiteAdapter implements DatabaseAdapter {
  async query(service: string, sql: string): Promise<string> {
    const dbPath = this.getDatabasePath(service);
    return dockerExec(service, `sqlite3 ${dbPath} "${sql}"`);
  }
  
  async backup(service: string, options: BackupOptions): Promise<string> {
    const dbPath = this.getDatabasePath(service);
    const output = options.output || `./sqlite-backup-${Date.now()}.db`;
    
    await dockerExec(service, `sqlite3 ${dbPath} ".backup ${output}"`);
    return output;
  }
}
```

### Adapter Registry

```typescript
class AdapterRegistry {
  private adapters = new Map<string, DatabaseAdapter>();
  
  constructor() {
    this.register('postgresql', new PostgreSQLAdapter());
    this.register('postgres', new PostgreSQLAdapter());
    this.register('redis', new RedisAdapter());
    this.register('sqlite', new SQLiteAdapter());
    this.register('mysql', new MySQLAdapter());
    this.register('mongodb', new MongoDBAdapter());
  }
  
  get(serviceType: string): DatabaseAdapter {
    const adapter = this.adapters.get(serviceType);
    if (!adapter) {
      throw new Error(`No adapter found for ${serviceType}`);
    }
    return adapter;
  }
  
  register(type: string, adapter: DatabaseAdapter): void {
    this.adapters.set(type, adapter);
  }
}
```

---

## 🔒 Security Layer

### Secrets Masking

```typescript
class SecretsMasker {
  private readonly SECRET_KEYWORDS = [
    'PASSWORD',
    'TOKEN',
    'KEY',
    'SECRET',
    'API_KEY',
    'PRIVATE',
    'CREDENTIALS'
  ];
  
  maskSecrets(env: Record<string, string>): Record<string, string> {
    const masked: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(env)) {
      if (this.isSecret(key)) {
        masked[key] = '***MASKED***';
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }
  
  private isSecret(key: string): boolean {
    const upperKey = key.toUpperCase();
    return this.SECRET_KEYWORDS.some(keyword => 
      upperKey.includes(keyword)
    );
  }
}
```

### SQL Validation (Optional)

```typescript
class SQLValidator {
  private readonly DANGEROUS_PATTERNS = [
    /DROP\s+DATABASE/i,
    /DELETE\s+FROM\s+\w+(?!\s+WHERE)/i,  // DELETE without WHERE
    /TRUNCATE\s+TABLE/i,
    /DROP\s+TABLE/i
  ];
  
  validate(sql: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(sql)) {
        throw new Error(`Dangerous SQL detected: ${sql}`);
      }
    }
  }
}
```

### Path Validation

```typescript
class PathValidator {
  validate(path: string, projectRoot: string): void {
    const resolved = resolve(path);
    
    // Prevent directory traversal
    if (!resolved.startsWith(projectRoot)) {
      throw new Error('Path outside project directory');
    }
    
    // Prevent access to sensitive files
    const sensitive = ['.env', '.git', 'node_modules'];
    if (sensitive.some(s => resolved.includes(s))) {
      throw new Error('Access to sensitive files denied');
    }
  }
}
```

---

## 🛠️ Component Details

### Container Manager

**Container Discovery Strategy (Three-Level Fallback):**

```typescript
class ContainerManager {
  async listContainers(projectName: string, composeFile?: string, projectDir?: string): Promise<Container[]> {
    // Level 1: Docker Compose Labels (Priority - Direct Docker API call)
    const containers = await this.docker.listContainers({
      all: true,
      filters: {
        label: [`com.docker.compose.project=${projectName}`]
      }
    });
    
    if (containers.length > 0) {
      return containers.map(c => this.mapContainerInfo(c, projectName));
    }
    
    // Level 2: docker-compose ps CLI (Fallback for older versions)
    if (composeFile && projectDir) {
      const output = ComposeExec.run(composeFile, ['ps', '--format', 'json'], { cwd: projectDir });
      // Parse and map containers...
    }
    
    // Level 3: Name-based filter (Final fallback)
    return await this.docker.listContainers({
      all: true,
      filters: { name: [projectName] }
    });
  }
  
  async start(service: string, project: string): Promise<void> {
    await exec(`docker start ${project}_${service}`);
  }
  
  async stop(service: string, project: string): Promise<void> {
    await exec(`docker stop ${project}_${service}`);
  }
  
  async restart(service: string, project: string): Promise<void> {
    await exec(`docker restart ${project}_${service}`);
  }
  
  async logs(service: string, options: LogOptions): Promise<string> {
    const flags = [
      options.lines ? `--tail ${options.lines}` : '',
      options.follow ? '-f' : '',
      options.timestamps ? '-t' : ''
    ].filter(Boolean).join(' ');
    
    return exec(`docker logs ${flags} ${project}_${service}`);
  }
}
```

### Compose Manager

```typescript
class ComposeManager {
  async up(project: string, options: UpOptions): Promise<void> {
    const flags = [
      options.build ? '--build' : '',
      options.detach ? '-d' : ''
    ].filter(Boolean).join(' ');
    
    await exec(`docker-compose -p ${project} up ${flags}`);
  }
  
  async down(project: string, options: DownOptions): Promise<void> {
    const flags = options.volumes ? '-v' : '';
    await exec(`docker-compose -p ${project} down ${flags}`);
  }
  
  async config(project: string): Promise<string> {
    return exec(`docker-compose -p ${project} config`);
  }
}
```

---

## 🔄 Profile-Based Client Pool (v1.4.0+)

### Problem: Host-Based Caching Bug (BUG-011)

**Before v1.4.0**, Docker clients were cached by SSH host:

```typescript
// OLD: Cached by host (WRONG!)
const client = getDockerClient(sshConfig);
// Cache key: "prod.example.com"
```

**Bug scenario:**
```json
{
  "profiles": {
    "prod-admin": { 
      "host": "prod.example.com",
      "privateKeyPath": "~/.ssh/admin"
    },
    "prod-readonly": { 
      "host": "prod.example.com", 
      "privateKeyPath": "~/.ssh/readonly"
    }
  }
}
```

1. First call: `profile: "prod-admin"` → creates client with admin key ✅
2. Second call: `profile: "prod-readonly"` → **reuses cached client with admin key!** ❌

**Result:** Read-only profile has admin rights! 🔥

### Solution: Profile-Based Caching

**Since v1.4.0**, clients are cached by profile name:

```typescript
// NEW: Cached by profile name (CORRECT!)
const client = getDockerClientForProfile('prod-admin');
// Cache key: "prod-admin"

const client2 = getDockerClientForProfile('prod-readonly');
// Cache key: "prod-readonly" (separate client!)
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Profile-Based Client Pool                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Local Client (no profile):                                │
│  ┌──────────────────────────────────────┐                  │
│  │ getDockerClientForProfile()          │                  │
│  │ Cache key: LOCAL                     │                  │
│  │ → DockerClient (local Docker socket) │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  Remote Clients (profile-based):                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Profile: "prod-admin"                              │    │
│  │ getDockerClientForProfile('prod-admin')            │    │
│  │ Cache key: "prod-admin"                            │    │
│  │ → DockerClient (SSH tunnel with admin key)        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Profile: "prod-readonly"                           │    │
│  │ getDockerClientForProfile('prod-readonly')         │    │
│  │ Cache key: "prod-readonly"                         │    │
│  │ → DockerClient (SSH tunnel with readonly key)     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

1. ✅ **Correctness** — Each profile uses its own SSH key
2. ✅ **Security** — No key conflicts or wrong permissions
3. ✅ **Performance** — SSH tunnels still cached per profile
4. ✅ **Explicit** — Profile name makes it clear which config is used
5. ✅ **Scalability** — Works with N profiles in parallel

### Internal Changes

**Managers (v1.4.0):**
```typescript
// OLD (v1.3.x):
class ContainerManager {
  constructor(sshConfig?: SSHConfig | null) {
    this.dockerClient = getDockerClient(sshConfig);
  }
}

// NEW (v1.4.0):
class ContainerManager {
  constructor(profileName?: string) {
    this.dockerClient = getDockerClientForProfile(profileName);
  }
}
```

**Tools:**
```typescript
// OLD:
const sshConfig = resolveSSHConfig(args);
const manager = new ContainerManager(sshConfig);

// NEW:
const manager = new ContainerManager(args.profile);
```

### Client Pool Lifecycle

1. **First call** with profile → Load config, create client, cache
2. **Subsequent calls** with same profile → Return cached client
3. **Different profile** → Create new client, cache separately
4. **Cleanup** → `clearClientPool()` cleans up all SSH tunnels

---

## 📊 Data Flow

### Example: docker_db_query("postgres", "SELECT * FROM users")

```
1. MCP Client (Cursor)
   ↓ JSON-RPC request
   
2. MCP Server receives tool call
   ↓ Parse parameters
   
3. Project Discovery
   ↓ Find docker-compose.yml
   ↓ Identify "postgres" service
   
4. Adapter Registry
   ↓ Get PostgreSQLAdapter
   
5. PostgreSQLAdapter
   ↓ Build psql command
   ↓ Get connection info from env
   
6. Container Manager
   ↓ docker exec postgres_container psql -U user -d db -c "SELECT ..."
   
7. Docker Engine
   ↓ Execute command in container
   ↓ Return output
   
8. MCP Server
   ↓ Format response
   ↓ JSON-RPC response
   
9. MCP Client (Cursor)
   ↓ Display result to user
```

---

## 🎯 Design Trade-offs

### Why 20 Commands?

**Decision:** Limited set of specialized commands + universal executor

**Alternatives Considered:**
- 50+ specialized commands (too complex)
- Only `docker_exec` (not user-friendly)

**Rationale:**
- 20 commands cover 95% of use cases (evolved from 16 to 20 in v1.2.0+)
- `docker_exec` provides unlimited extensibility
- Easy to learn and remember
- Minimal maintenance burden
- CLI interface for direct command execution
- Added resource monitoring (stats, resource_list), project discovery (projects), and utility tools (mcp_health, profile_info)

### Why Auto-Discovery?

**Decision:** Automatic project detection

**Alternatives Considered:**
- Manual configuration file
- Explicit project parameter in every command

**Rationale:**
- Zero configuration for users
- Works with any project structure
- Reduces cognitive load
- Follows principle of least surprise

### Why TypeScript?

**Decision:** TypeScript over JavaScript

**Rationale:**
- Type safety for MCP protocol
- Better IDE support
- Easier refactoring
- Self-documenting code
- Catches errors at compile time

---

## 🚀 Performance Considerations

### Caching

```typescript
class ProjectCache {
  private cache = new Map<string, ProjectConfig>();
  private ttl = 60000; // 1 minute
  
  get(cwd: string): ProjectConfig | null {
    const cached = this.cache.get(cwd);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.config;
    }
    return null;
  }
  
  set(cwd: string, config: ProjectConfig): void {
    this.cache.set(cwd, {
      config,
      timestamp: Date.now()
    });
  }
}
```

### Lazy Loading

```typescript
// Adapters loaded only when needed
class AdapterRegistry {
  private adapters = new Map<string, () => DatabaseAdapter>();
  
  register(type: string, factory: () => DatabaseAdapter): void {
    this.adapters.set(type, factory);
  }
  
  get(type: string): DatabaseAdapter {
    const factory = this.adapters.get(type);
    return factory(); // Instantiate on demand
  }
}
```

---

## 📈 Future Enhancements

### Phase 2
- MySQL adapter
- MongoDB adapter
- Docker stats/monitoring
- Network management

### Phase 3
- Kubernetes support
- Multi-project management
- Custom adapter plugins
- Web UI for configuration

---

**Architecture designed for simplicity, extensibility, and real-world usage.**

