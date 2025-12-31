# Design Decisions

> Why we made certain choices in Docker MCP Server

## Table of Contents

- [Core Philosophy](#core-philosophy)
- [Command Set](#command-set)
- [Auto-Discovery](#auto-discovery)
- [Database Adapters](#database-adapters)
- [Security](#security)
- [Technology Stack](#technology-stack)
- [Trade-offs](#trade-offs)

---

## Core Philosophy

### Universal, Not Project-Specific

**Decision:** Build a universal tool that works with any Docker project.

**Alternatives Considered:**
1. Project-specific MCP server (e.g., only for Dungeon Mayhem)
2. Framework-specific servers (Django MCP, Next.js MCP, etc.)
3. Universal server (chosen)

**Rationale:**
- **Reusability** — One tool for all projects
- **Community value** — Open source tool anyone can use
- **Maintenance** — Single codebase to maintain
- **Learning curve** — Learn once, use everywhere

**Impact:**
- No hardcoded container names or project assumptions
- Auto-discovery of project structure required
- Adapter pattern for different databases
- Generic naming conventions

---

## Command Set

### Why 15 Commands?

**Decision:** Limited set of 15 specialized commands + universal executor.

**Alternatives Considered:**

| Approach | Commands | Pros | Cons |
|----------|----------|------|------|
| Minimal | 1-5 | Simple | Not user-friendly |
| **Balanced** | **15** | **Covers 95% cases** | **Chosen** |
| Comprehensive | 50+ | Feature-rich | Complex, hard to maintain |

**Rationale:**
- **Pareto Principle** — 15 commands cover 95% of use cases
- **Learnability** — Easy to remember and discover
- **Extensibility** — `docker_exec` provides unlimited flexibility
- **Maintenance** — Reasonable codebase size

**Command Categories:**

```
Container Management (7)  — Most common operations
├─ list, start, stop, restart
├─ logs (with follow mode)
└─ compose up/down

Database Operations (4)   — Essential DB tasks
├─ query (universal for all DB types)
├─ backup/restore
└─ status

Environment (3)           — Configuration management
├─ env list (with secret masking)
├─ compose config
└─ healthcheck

Universal (1)             — Unlimited extensibility
└─ exec (runs anything)
```

### Why docker_exec is Critical

**Decision:** Include universal executor as escape hatch.

**Rationale:**
- **Future-proof** — Handles unforeseen use cases
- **Project-specific needs** — Each project has unique commands
- **No feature bloat** — Don't need specialized commands for everything

**Examples of docker_exec usage:**
```typescript
// Testing frameworks
docker_exec("web", "pytest tests/")
docker_exec("web", "npm test")
docker_exec("web", "go test ./...")

// Migrations
docker_exec("web", "alembic upgrade head")
docker_exec("web", "python manage.py migrate")
docker_exec("web", "npm run migrate")

// Package management
docker_exec("web", "pip install requests")
docker_exec("web", "npm install lodash")

// Custom scripts
docker_exec("web", "python scripts/seed_data.py")
docker_exec("web", "./deploy.sh")
```

---

## Auto-Discovery

### Why Automatic Project Detection?

**Decision:** Automatically find and parse `docker-compose.yml`.

**Alternatives Considered:**

1. **Manual configuration file** (`.docker-mcp.json`)
   ```json
   {
     "project": "my-app",
     "services": {
       "web": {...},
       "db": {...}
     }
   }
   ```
   - ❌ Extra configuration burden
   - ❌ Can become out of sync with docker-compose.yml

2. **Explicit project parameter in every command**
   ```typescript
   docker_container_list({project: "my-app"})
   ```
   - ❌ Repetitive
   - ❌ Poor UX

3. **Auto-discovery** (chosen)
   ```typescript
   docker_container_list()  // Just works!
   ```
   - ✅ Zero configuration
   - ✅ Always in sync with docker-compose.yml
   - ✅ Best UX

**How It Works:**

```typescript
1. Start from current working directory (CWD)
2. Look for docker-compose.yml (or variants)
3. If not found, go up one directory
4. Repeat until found or reach filesystem root
5. Parse YAML and extract project structure
6. Cache for 60 seconds to avoid repeated parsing
```

**Edge Cases Handled:**
- Multiple docker-compose files (dev, prod) → Use first found
- No docker-compose.yml → Clear error message
- Invalid YAML → Parse error with line number
- Nested projects → Use closest docker-compose.yml

---

## Database Adapters

### Why Adapter Pattern?

**Decision:** Extensible adapter pattern for different databases.

**Alternatives Considered:**

1. **Hardcoded database logic**
   ```typescript
   if (type === 'postgres') {
     // PostgreSQL logic
   } else if (type === 'redis') {
     // Redis logic
   }
   ```
   - ❌ Not extensible
   - ❌ Violates Open/Closed Principle

2. **Plugin system with dynamic loading**
   ```typescript
   loadPlugin('@docker-mcp/adapter-postgres')
   ```
   - ❌ Complex
   - ❌ Dependency management issues

3. **Adapter pattern** (chosen)
   ```typescript
   class PostgreSQLAdapter implements DatabaseAdapter {
     query(sql) { ... }
     backup() { ... }
   }
   ```
   - ✅ Clean separation
   - ✅ Easy to add new adapters
   - ✅ Testable

**Adapter Interface:**

```typescript
interface DatabaseAdapter {
  query(service: string, sql: string): Promise<string>;
  backup(service: string, options: BackupOptions): Promise<string>;
  restore(service: string, path: string): Promise<void>;
  status(service: string): Promise<DBStatus>;
  getConnectionInfo(service: ServiceConfig): ConnectionInfo;
}
```

**Benefits:**
- **Consistency** — Same interface for all databases
- **Extensibility** — Add MySQL, MongoDB without changing core
- **Testability** — Mock adapters for testing
- **Type safety** — TypeScript enforces interface

### Which Databases in v1.0?

**Decision:** PostgreSQL, Redis, SQLite in first version.

**Rationale:**

| Database | Priority | Reason |
|----------|----------|--------|
| PostgreSQL | ✅ High | Most popular relational DB |
| Redis | ✅ High | Most popular cache/queue |
| SQLite | ✅ Medium | Lightweight projects, testing |
| MySQL | ⏳ v1.1 | Similar to PostgreSQL |
| MongoDB | ⏳ v1.2 | Different query language |

**Why not MySQL in v1.0?**
- Very similar to PostgreSQL (same commands: `mysql`, `mysqldump`)
- Can be added in v1.1 with minimal effort
- Focus on getting v1.0 right first

**Why SQLite despite being "lightweight"?**
- Common in development/testing
- Simple to implement
- Good for demos and examples

---

## Security

### Why Mask Secrets Automatically?

**Decision:** Automatically mask sensitive environment variables.

**Rationale:**
- **Screen sharing** — Safe to show env vars in demos
- **Logging** — Secrets don't leak into logs
- **AI training** — Prevent secrets in AI training data
- **Default secure** — Opt-in to show secrets, not opt-out

**Keywords that trigger masking:**
```typescript
const SECRET_KEYWORDS = [
  'PASSWORD',
  'TOKEN',
  'KEY',
  'SECRET',
  'API_KEY',
  'PRIVATE',
  'CREDENTIALS',
  'AUTH'
];
```

**Example:**
```typescript
// Original .env
DATABASE_PASSWORD=super_secret_123
API_TOKEN=abc123xyz
DEBUG=true

// docker_env_list() output
DATABASE_PASSWORD=***MASKED***
API_TOKEN=***MASKED***
DEBUG=true  // Not masked
```

**Override if needed:**
```typescript
docker_env_list({maskSecrets: false})  // Show all
```

### SQL Validation: Optional, Not Required

**Decision:** SQL validation is optional (disabled by default).

**Alternatives Considered:**

1. **Always validate** (block dangerous SQL)
   - ❌ False positives (legitimate DELETE with WHERE)
   - ❌ Limits power users

2. **Never validate** (trust user)
   - ❌ Easy to make mistakes
   - ❌ No safety net

3. **Optional validation** (chosen)
   - ✅ Safe by default for beginners
   - ✅ Power users can disable
   - ✅ Configurable per-project

**Enable validation:**
```json
{
  "env": {
    "DOCKER_MCP_VALIDATE_SQL": "true"
  }
}
```

**Blocked patterns:**
- `DROP DATABASE`
- `DELETE FROM table` (without WHERE)
- `TRUNCATE TABLE`
- `DROP TABLE`

---

## Technology Stack

### Why TypeScript?

**Decision:** TypeScript over JavaScript.

**Alternatives Considered:**

| Language | Pros | Cons |
|----------|------|------|
| JavaScript | Faster to write | No type safety |
| **TypeScript** | **Type safety, IDE support** | **Chosen** |
| Python | Great for scripting | Slower startup |
| Go | Fast, compiled | Overkill for MCP |

**Rationale:**
- **MCP SDK** — Official SDK is TypeScript
- **Type safety** — Catch errors at compile time
- **IDE support** — Better autocomplete and refactoring
- **Documentation** — Types serve as documentation
- **Community** — Most MCP servers are TypeScript

### Why Node.js?

**Decision:** Node.js runtime.

**Rationale:**
- **MCP SDK** — Official SDK is Node.js
- **STDIO transport** — Node.js handles STDIO well
- **JSON parsing** — Native JSON support
- **Async/await** — Clean async code
- **npm ecosystem** — Easy distribution

### Dependencies

**Decision:** Minimal dependencies.

**Core dependencies:**
```json
{
  "@modelcontextprotocol/sdk": "^0.6.0",  // MCP protocol
  "yaml": "^2.3.4",                       // Parse docker-compose.yml
  "dotenv": "^16.4.5"                     // Parse .env files
}
```

**Why minimal?**
- **Security** — Fewer attack vectors
- **Reliability** — Fewer breaking changes
- **Size** — Smaller package
- **Maintenance** — Less to update

**Avoided dependencies:**
- ❌ Docker SDK — Use CLI instead (more stable)
- ❌ ORM — Direct SQL is fine
- ❌ Logging library — Use console (MCP uses stderr)
- ❌ CLI framework — Not needed for MCP server

---

## Trade-offs

### Performance vs Simplicity

**Trade-off:** Chose simplicity over maximum performance.

**Examples:**

1. **Project discovery** — Parse YAML on every command
   - Alternative: Cache parsed config
   - Chosen: Parse fresh (always up-to-date)
   - Impact: ~10-50ms overhead (acceptable)

2. **Docker CLI vs Docker SDK**
   - Alternative: Use Docker SDK (faster)
   - Chosen: Use CLI (simpler, more stable)
   - Impact: ~50-100ms overhead (acceptable)

**Rationale:**
- MCP commands are not performance-critical
- User is waiting for Docker operations (seconds), not parsing (milliseconds)
- Simplicity = fewer bugs = better UX

### Features vs Maintenance

**Trade-off:** Limited feature set to keep maintenance manageable.

**Not included in v1.0:**
- ❌ Docker Swarm support
- ❌ Kubernetes support
- ❌ Docker stats/monitoring
- ❌ Network management
- ❌ Volume management
- ❌ Image management

**Rationale:**
- Focus on core use cases (95% of users)
- Can be added later if demand exists
- Keep codebase maintainable by one person

### Flexibility vs Safety

**Trade-off:** Chose flexibility with optional safety.

**Examples:**

1. **SQL validation** — Optional, not enforced
2. **Secret masking** — Can be disabled
3. **docker_exec** — No command restrictions

**Rationale:**
- Trust users to know what they're doing
- Power users need flexibility
- Provide safety nets, but don't enforce them

---

## Lessons from Similar Tools

### What We Learned

**From Docker Compose:**
- ✅ YAML is good for configuration
- ✅ Service-based architecture is intuitive
- ❌ Too many flags = confusing

**From Kubernetes:**
- ✅ Declarative is powerful
- ❌ Too complex for simple use cases

**From Heroku CLI:**
- ✅ Simple commands (`heroku logs`, `heroku restart`)
- ✅ Auto-detection of project
- ❌ Vendor lock-in

**From existing MCP servers:**
- ✅ Keep tool count low (10-20 tools)
- ✅ Good error messages are critical
- ❌ Too generic = not useful

---

## Future Considerations

### What Might Change

**If user feedback suggests:**

1. **More databases** → Add MySQL, MongoDB adapters
2. **Kubernetes** → Separate `k8s-mcp-server` project
3. **Monitoring** → Add `docker_stats` command
4. **Networks** → Add network management commands

**What won't change:**
- Core philosophy (universal, not project-specific)
- Auto-discovery (too valuable)
- Adapter pattern (proven to work)
- TypeScript (ecosystem standard)

---

## Conclusion

Every decision was made with these principles in mind:

1. **Universal** — Works with any project
2. **Simple** — Easy to understand and use
3. **Extensible** — Can grow without breaking
4. **Maintainable** — One person can maintain it
5. **Secure** — Safe by default

**Result:** A tool that solves real problems without creating new ones.

---

**Design decisions for Docker MCP Server v1.0.0**

