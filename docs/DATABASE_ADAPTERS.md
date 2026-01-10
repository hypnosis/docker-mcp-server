# Database Adapters

> How to add support for new databases

## Table of Contents

- [Overview](#overview)
- [Adapter Interface](#adapter-interface)
- [Existing Adapters](#existing-adapters)
- [Creating a New Adapter](#creating-a-new-adapter)
- [Testing Adapters](#testing-adapters)
- [Best Practices](#best-practices)

---

## Overview

Docker MCP Server uses an **adapter pattern** to support different database types. Each database has its own adapter that implements a common interface.

### Why Adapters?

- **Extensibility** — Easy to add new databases
- **Consistency** — Same interface for all databases
- **Testability** — Mock adapters for testing
- **Separation of Concerns** — Database logic isolated from core

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              docker_db_query("postgres", sql)           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  AdapterRegistry                        │
│  • Detects database type from service config            │
│  • Returns appropriate adapter                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│              PostgreSQLAdapter.query(sql)               │
│  • Builds psql command                                  │
│  • Gets connection info from env                        │
│  • Executes via docker exec                             │
└─────────────────────────────────────────────────────────┘
```

---

## Adapter Interface

All database adapters must implement the `DatabaseAdapter` interface:

```typescript
interface DatabaseAdapter {
  /**
   * Execute a query or command
   */
  query(
    service: string,
    query: string,
    options?: QueryOptions
  ): Promise<string>;
  
  /**
   * Create a backup
   */
  backup(
    service: string,
    options: BackupOptions
  ): Promise<string>;
  
  /**
   * Restore from backup
   */
  restore(
    service: string,
    backupPath: string,
    options?: RestoreOptions
  ): Promise<void>;
  
  /**
   * Get database status
   */
  status(service: string): Promise<DBStatus>;
  
  /**
   * Get connection info from environment/config
   */
  getConnectionInfo(
    service: ServiceConfig,
    env: Record<string, string>
  ): ConnectionInfo;
}
```

### Type Definitions

```typescript
interface QueryOptions {
  database?: string;
  user?: string;
  format?: 'table' | 'json' | 'csv';
}

interface BackupOptions {
  output?: string;
  format?: 'sql' | 'custom' | 'tar' | 'directory';
  compress?: boolean;
  tables?: string[];
}

interface RestoreOptions {
  database?: string;
  clean?: boolean;
  dataOnly?: boolean;
  schemaOnly?: boolean;
}

interface DBStatus {
  type: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  size?: string;
  connections?: number;
  uptime?: string;
  memory?: string;
  additional?: Record<string, any>;
}

interface ConnectionInfo {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}
```

---

## Existing Adapters

### PostgreSQL Adapter

**File:** `src/adapters/postgresql.ts`

```typescript
export class PostgreSQLAdapter implements DatabaseAdapter {
  async query(service: string, sql: string, options?: QueryOptions): Promise<string> {
    const conn = this.getConnectionInfo(service);
    const db = options?.database || conn.database;
    const user = options?.user || conn.user;
    
    const command = `psql -U ${user} -d ${db} -c "${sql}"`;
    return dockerExec(service, command);
  }
  
  async backup(service: string, options: BackupOptions): Promise<string> {
    const conn = this.getConnectionInfo(service);
    const format = options.format || 'custom';
    const output = options.output || `./backup-${Date.now()}.dump`;
    
    let command = `pg_dump -U ${conn.user} -d ${conn.database}`;
    
    if (format === 'custom') {
      command += ` -Fc`;  // Custom format (compressed)
    } else if (format === 'tar') {
      command += ` -Ft`;  // Tar format
    } else if (format === 'directory') {
      command += ` -Fd`;  // Directory format
    }
    
    if (options.tables && options.tables.length > 0) {
      options.tables.forEach(table => {
        command += ` -t ${table}`;
      });
    }
    
    command += ` -f ${output}`;
    
    await dockerExec(service, command);
    return output;
  }
  
  async restore(service: string, backupPath: string, options?: RestoreOptions): Promise<void> {
    const conn = this.getConnectionInfo(service);
    const db = options?.database || conn.database;
    
    let command = `pg_restore -U ${conn.user} -d ${db}`;
    
    if (options?.clean) {
      command += ` --clean`;
    }
    if (options?.dataOnly) {
      command += ` --data-only`;
    }
    if (options?.schemaOnly) {
      command += ` --schema-only`;
    }
    
    command += ` ${backupPath}`;
    
    await dockerExec(service, command);
  }
  
  async status(service: string): Promise<DBStatus> {
    const version = await this.query(service, 'SELECT version()');
    const size = await this.query(service, 
      "SELECT pg_size_pretty(pg_database_size(current_database()))");
    const connections = await this.query(service,
      'SELECT count(*) FROM pg_stat_activity');
    const uptime = await this.query(service,
      "SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time())");
    
    return {
      type: 'postgresql',
      version: this.parseVersion(version),
      status: 'healthy',
      size: size.trim(),
      connections: parseInt(connections.trim()),
      uptime: uptime.trim()
    };
  }
  
  getConnectionInfo(service: ServiceConfig): ConnectionInfo {
    const env = loadEnv();
    
    return {
      host: service.hostname || 'localhost',
      port: 5432,
      user: env.POSTGRES_USER || 'postgres',
      password: env.POSTGRES_PASSWORD,
      database: env.POSTGRES_DB || 'postgres'
    };
  }
  
  private parseVersion(versionString: string): string {
    const match = versionString.match(/PostgreSQL (\d+\.\d+)/);
    return match ? match[1] : 'unknown';
  }
}
```

### Redis Adapter

**File:** `src/adapters/redis.ts`

```typescript
export class RedisAdapter implements DatabaseAdapter {
  async query(service: string, command: string): Promise<string> {
    return dockerExec(service, `redis-cli ${command}`);
  }
  
  async backup(service: string, options: BackupOptions): Promise<string> {
    // Trigger SAVE to create dump.rdb
    await this.query(service, 'SAVE');
    
    // Copy dump.rdb from container
    const output = options.output || `./redis-backup-${Date.now()}.rdb`;
    await dockerExec(service, `cp /data/dump.rdb ${output}`);
    
    return output;
  }
  
  async restore(service: string, backupPath: string): Promise<void> {
    // Stop Redis, replace dump.rdb, restart
    await dockerExec(service, `redis-cli SHUTDOWN NOSAVE`);
    await dockerExec(service, `cp ${backupPath} /data/dump.rdb`);
    // Container will auto-restart
  }
  
  async status(service: string): Promise<DBStatus> {
    const info = await this.query(service, 'INFO');
    const parsed = this.parseRedisInfo(info);
    
    return {
      type: 'redis',
      version: parsed.redis_version,
      status: 'healthy',
      memory: parsed.used_memory_human,
      uptime: this.formatUptime(parsed.uptime_in_seconds),
      additional: {
        keys: parsed.db0?.keys || 0,
        clients: parsed.connected_clients
      }
    };
  }
  
  getConnectionInfo(service: ServiceConfig): ConnectionInfo {
    const env = loadEnv();
    
    return {
      host: service.hostname || 'localhost',
      port: 6379,
      user: '',
      password: env.REDIS_PASSWORD,
      database: '0'
    };
  }
  
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    info.split('\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key.trim()] = value.trim();
      }
    });
    
    return result;
  }
  
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days} days ${hours} hours`;
  }
}
```

### SQLite Adapter

**File:** `src/adapters/sqlite.ts`

```typescript
export class SQLiteAdapter implements DatabaseAdapter {
  async query(service: string, sql: string, options?: QueryOptions): Promise<string> {
    const dbPath = this.getDatabasePath(service);
    return dockerExec(service, `sqlite3 ${dbPath} "${sql}"`);
  }
  
  async backup(service: string, options: BackupOptions): Promise<string> {
    const dbPath = this.getDatabasePath(service);
    const output = options.output || `./sqlite-backup-${Date.now()}.db`;
    
    await dockerExec(service, `sqlite3 ${dbPath} ".backup ${output}"`);
    return output;
  }
  
  async restore(service: string, backupPath: string): Promise<void> {
    const dbPath = this.getDatabasePath(service);
    await dockerExec(service, `cp ${backupPath} ${dbPath}`);
  }
  
  async status(service: string): Promise<DBStatus> {
    const version = await this.query(service, 'SELECT sqlite_version()');
    const tables = await this.query(service, 
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table'");
    
    return {
      type: 'sqlite',
      version: version.trim(),
      status: 'healthy',
      additional: {
        tables: parseInt(tables.trim())
      }
    };
  }
  
  getConnectionInfo(service: ServiceConfig): ConnectionInfo {
    return {
      host: 'localhost',
      port: 0,
      user: '',
      database: this.getDatabasePath(service)
    };
  }
  
  private getDatabasePath(service: ServiceConfig): string {
    const env = loadEnv();
    return env.SQLITE_DATABASE || '/app/db.sqlite3';
  }
}
```

---

## Creating a New Adapter

### Step 1: Create Adapter File

Create `src/adapters/mysql.ts`:

```typescript
import { DatabaseAdapter, QueryOptions, BackupOptions, RestoreOptions, DBStatus, ConnectionInfo } from './database-adapter';
import { dockerExec } from '../utils/docker';
import { loadEnv } from '../utils/env';

export class MySQLAdapter implements DatabaseAdapter {
  async query(service: string, sql: string, options?: QueryOptions): Promise<string> {
    const conn = this.getConnectionInfo(service);
    const db = options?.database || conn.database;
    const user = options?.user || conn.user;
    
    const command = `mysql -u ${user} -p${conn.password} -D ${db} -e "${sql}"`;
    return dockerExec(service, command);
  }
  
  async backup(service: string, options: BackupOptions): Promise<string> {
    const conn = this.getConnectionInfo(service);
    const output = options.output || `./mysql-backup-${Date.now()}.sql`;
    
    let command = `mysqldump -u ${conn.user} -p${conn.password} ${conn.database}`;
    
    if (options.tables && options.tables.length > 0) {
      command += ` ${options.tables.join(' ')}`;
    }
    
    command += ` > ${output}`;
    
    await dockerExec(service, command);
    return output;
  }
  
  async restore(service: string, backupPath: string, options?: RestoreOptions): Promise<void> {
    const conn = this.getConnectionInfo(service);
    const db = options?.database || conn.database;
    
    const command = `mysql -u ${conn.user} -p${conn.password} ${db} < ${backupPath}`;
    await dockerExec(service, command);
  }
  
  async status(service: string): Promise<DBStatus> {
    const version = await this.query(service, 'SELECT VERSION()');
    const size = await this.query(service, `
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
      FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
    `);
    const connections = await this.query(service,
      'SELECT COUNT(*) FROM information_schema.PROCESSLIST');
    
    return {
      type: 'mysql',
      version: version.trim(),
      status: 'healthy',
      size: `${size.trim()} MB`,
      connections: parseInt(connections.trim())
    };
  }
  
  getConnectionInfo(service: ServiceConfig): ConnectionInfo {
    const env = loadEnv();
    
    return {
      host: service.hostname || 'localhost',
      port: 3306,
      user: env.MYSQL_USER || 'root',
      password: env.MYSQL_PASSWORD || env.MYSQL_ROOT_PASSWORD,
      database: env.MYSQL_DATABASE || 'mysql'
    };
  }
}
```

### Step 2: Register Adapter

Update `src/adapters/index.ts`:

```typescript
import { PostgreSQLAdapter } from './postgresql';
import { RedisAdapter } from './redis';
import { SQLiteAdapter } from './sqlite';
import { MySQLAdapter } from './mysql';  // NEW

export class AdapterRegistry {
  private adapters = new Map<string, DatabaseAdapter>();
  
  constructor() {
    // PostgreSQL
    this.register('postgresql', new PostgreSQLAdapter());
    this.register('postgres', new PostgreSQLAdapter());
    
    // Redis
    this.register('redis', new RedisAdapter());
    
    // SQLite
    this.register('sqlite', new SQLiteAdapter());
    this.register('sqlite3', new SQLiteAdapter());
    
    // MySQL - NEW
    this.register('mysql', new MySQLAdapter());
    this.register('mariadb', new MySQLAdapter());
  }
  
  get(serviceType: string): DatabaseAdapter {
    const adapter = this.adapters.get(serviceType.toLowerCase());
    if (!adapter) {
      throw new Error(`No adapter found for database type: ${serviceType}`);
    }
    return adapter;
  }
  
  register(type: string, adapter: DatabaseAdapter): void {
    this.adapters.set(type.toLowerCase(), adapter);
  }
}
```

### Step 3: Update Type Detection

Update `src/discovery/project-discovery.ts`:

```typescript
detectServiceType(service: ServiceConfig): string {
  const image = service.image?.toLowerCase() || '';
  
  if (image.includes('postgres')) return 'postgresql';
  if (image.includes('redis')) return 'redis';
  if (image.includes('mysql')) return 'mysql';      // NEW
  if (image.includes('mariadb')) return 'mysql';    // NEW
  if (image.includes('mongo')) return 'mongodb';
  if (image.includes('sqlite')) return 'sqlite';
  
  return 'generic';
}
```

### Step 4: Write Tests

Create `tests/adapters/mysql.test.ts`:

```typescript
import { MySQLAdapter } from '../../src/adapters/mysql';

describe('MySQLAdapter', () => {
  let adapter: MySQLAdapter;
  
  beforeEach(() => {
    adapter = new MySQLAdapter();
  });
  
  describe('query', () => {
    it('should execute SELECT query', async () => {
      const result = await adapter.query('mysql', 'SELECT 1');
      expect(result).toContain('1');
    });
    
    it('should handle errors gracefully', async () => {
      await expect(
        adapter.query('mysql', 'INVALID SQL')
      ).rejects.toThrow();
    });
  });
  
  describe('backup', () => {
    it('should create backup file', async () => {
      const output = await adapter.backup('mysql', {});
      expect(output).toMatch(/mysql-backup-\d+\.sql/);
    });
    
    it('should backup specific tables', async () => {
      const output = await adapter.backup('mysql', {
        tables: ['users', 'orders']
      });
      expect(output).toBeDefined();
    });
  });
  
  describe('status', () => {
    it('should return database status', async () => {
      const status = await adapter.status('mysql');
      expect(status.type).toBe('mysql');
      expect(status.version).toMatch(/\d+\.\d+/);
      expect(status.status).toBe('healthy');
    });
  });
});
```

### Step 5: Update Documentation

Add to `README.md`:

```markdown
### Supported Databases

- ✅ PostgreSQL
- ✅ Redis
- ✅ SQLite
- ✅ MySQL / MariaDB (NEW!)
- ⏳ MongoDB (coming soon)
```

---

## Testing Adapters

### Unit Tests

```typescript
// tests/adapters/postgresql.test.ts
describe('PostgreSQLAdapter', () => {
  it('should build correct psql command', () => {
    const adapter = new PostgreSQLAdapter();
    const command = adapter.buildQueryCommand('mydb', 'user', 'SELECT 1');
    expect(command).toBe('psql -U user -d mydb -c "SELECT 1"');
  });
});
```

### Integration Tests

```typescript
// tests/integration/adapters.test.ts
describe('Database Adapters Integration', () => {
  beforeAll(async () => {
    // Start test containers
    await exec('docker-compose -f docker-compose.test.yml up -d');
  });
  
  afterAll(async () => {
    await exec('docker-compose -f docker-compose.test.yml down');
  });
  
  it('should query PostgreSQL', async () => {
    const adapter = new PostgreSQLAdapter();
    const result = await adapter.query('postgres', 'SELECT 1');
    expect(result).toContain('1');
  });
  
  it('should backup and restore PostgreSQL', async () => {
    const adapter = new PostgreSQLAdapter();
    
    // Create test data
    await adapter.query('postgres', 'CREATE TABLE test (id INT)');
    await adapter.query('postgres', 'INSERT INTO test VALUES (1)');
    
    // Backup
    const backupPath = await adapter.backup('postgres', {});
    
    // Drop table
    await adapter.query('postgres', 'DROP TABLE test');
    
    // Restore
    await adapter.restore('postgres', backupPath);
    
    // Verify
    const result = await adapter.query('postgres', 'SELECT * FROM test');
    expect(result).toContain('1');
  });
});
```

---

## Best Practices

### 1. Get Environment Variables from Container (v1.3.1+)

**Important:** Always prioritize environment variables from the running container over compose file.

```typescript
// ✅ GOOD: Get env from container first, fallback to compose file
async query(service: string, query: string, options?: QueryOptions, projectConfig?: ProjectConfig): Promise<string> {
  const project = projectConfig || await this.projectDiscovery.findProject();
  const serviceConfig = project.services[service];
  
  // Get env from running container first (more reliable)
  const containerEnv = await this.containerManager.getContainerEnv(
    service, 
    project.name, 
    project.composeFile, 
    project.projectDir
  );
  
  // Fallback to compose file if container env unavailable
  const composeEnv = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
  const env = containerEnv || composeEnv;
  
  const conn = this.getConnectionInfo(serviceConfig, env);
  // ... rest of method
}
```

**Why?**
- Container may be started with different compose file (e.g., `docker-compose.test.yml`)
- Environment variables in running container may differ from compose file
- Prevents "role postgres does not exist" and similar errors
- More reliable connection parameters

**Example Problem:**
```yaml
# docker-compose.yml (discovered)
postgres:
  environment:
    POSTGRES_USER: postgres  # ← Read from here (wrong)

# docker-compose.test.yml (actually running)
postgres:
  environment:
    POSTGRES_USER: testuser  # ← Container has this (correct)
```

**Solution:**
Get env vars from `container.inspect().Config.Env` first, fallback to compose file.

### 2. Handle Passwords Securely

```typescript
// ❌ BAD: Password in command visible in logs
const command = `mysql -u user -pMyPassword -e "${sql}"`;

// ✅ GOOD: Use environment variable or config file
const command = `mysql --defaults-extra-file=./mysql.cnf -e "${sql}"`;
```

### 2. Validate Input

```typescript
async query(service: string, sql: string): Promise<string> {
  // Validate SQL if enabled
  if (process.env.DOCKER_MCP_VALIDATE_SQL === 'true') {
    this.validateSQL(sql);
  }
  
  // Escape quotes
  const escapedSQL = sql.replace(/"/g, '\\"');
  
  return dockerExec(service, `psql -c "${escapedSQL}"`);
}
```

### 3. Provide Good Error Messages

```typescript
async backup(service: string, options: BackupOptions): Promise<string> {
  try {
    return await this.performBackup(service, options);
  } catch (error) {
    throw new Error(
      `Failed to backup ${service}: ${error.message}\n` +
      `Hint: Check that the database is running and accessible.`
    );
  }
}
```

### 4. Support Common Formats

```typescript
async query(service: string, sql: string, options?: QueryOptions): Promise<string> {
  const format = options?.format || 'table';
  
  let command = `psql -c "${sql}"`;
  
  if (format === 'json') {
    command += ' --json';
  } else if (format === 'csv') {
    command += ' --csv';
  }
  
  return dockerExec(service, command);
}
```

### 5. Parse Output Consistently

```typescript
private parseVersion(output: string): string {
  // Handle different version formats
  const patterns = [
    /PostgreSQL (\d+\.\d+)/,
    /MySQL (\d+\.\d+\.\d+)/,
    /Redis server v=(\d+\.\d+\.\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) return match[1];
  }
  
  return 'unknown';
}
```

---

## Contributing Adapters

Want to add support for a new database? Great!

1. **Fork the repository**
2. **Create adapter** following the pattern above
3. **Write tests** (unit + integration)
4. **Update documentation**
5. **Submit pull request**

We especially welcome adapters for:
- MongoDB
- Cassandra
- InfluxDB
- TimescaleDB
- CockroachDB

---

**Database adapter guide for Docker MCP Server v1.0.0**

