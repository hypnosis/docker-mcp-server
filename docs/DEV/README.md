# Docker MCP Server - Developer Documentation

> Complete developer documentation for contributors and maintainers

## 📚 Overview

This directory contains all documentation for developers who want to contribute to, extend, or understand the internal architecture of Docker MCP Server.

---

## 🗂️ Documentation Structure

### Core Documentation

1. **[INDEX.md](./INDEX.md)** — Complete documentation index
   - Navigation guide
   - Quick links to all developer resources

2. **[ARCHITECTURE.md](../ARCHITECTURE.md)** — System Design
   - Technical architecture and design patterns
   - Component details and data flow
   - Performance considerations

3. **[DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md)** — Why We Made Certain Choices
   - Design philosophy and trade-offs
   - Architecture decisions explained
   - Alternatives considered

4. **[DEVELOPER_ARCHITECTURE.md](../DEVELOPER_ARCHITECTURE.md)** — Developer Guide
   - Project structure
   - Code organization
   - Development workflow

### API & Implementation

5. **[API_REFERENCE.md](../API_REFERENCE.md)** — Complete Command Reference
   - All 15 MCP commands documented
   - Parameters, options, examples
   - Error handling

6. **[DATABASE_ADAPTERS.md](../DATABASE_ADAPTERS.md)** — Adding Database Support
   - Adapter interface
   - Step-by-step guide for new adapters
   - Testing guidelines

### Examples & Reference

7. **[EXAMPLES.md](../EXAMPLES.md)** — Real-World Usage
   - Practical examples
   - Common workflows
   - Integration patterns

8. **[PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md)** — Complete Overview
   - High-level project summary
   - Implementation roadmap
   - Success metrics

---

## 🚀 Getting Started

### Development Setup

```bash
# Clone repository
git clone https://github.com/hypnosis/docker-mcp-server.git
cd docker-mcp-server

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Development mode (watch)
npm run dev
```

### Project Structure

```
docker-mcp-server/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── discovery/                # Project auto-discovery
│   │   ├── project-discovery.ts  # Main discovery logic
│   │   ├── compose-parser.ts     # YAML parser
│   │   └── config-merger.ts      # Multi-compose support
│   ├── adapters/                 # Database adapters
│   │   ├── adapter-registry.ts   # Adapter registry
│   │   ├── postgresql.ts         # PostgreSQL adapter
│   │   ├── redis.ts              # Redis adapter
│   │   └── sqlite.ts             # SQLite adapter
│   ├── managers/                 # Business logic layer
│   │   ├── container-manager.ts  # Container operations
│   │   ├── compose-manager.ts    # Compose operations
│   │   └── env-manager.ts        # Environment management
│   ├── tools/                    # MCP tool implementations
│   │   ├── container-tools.ts    # Container commands
│   │   ├── database-tools.ts     # Database commands
│   │   ├── env-tools.ts          # Environment commands
│   │   ├── executor-tool.ts      # Universal executor
│   │   └── mcp-health-tool.ts    # Health check
│   ├── security/                 # Security layer
│   │   └── sql-validator.ts      # SQL validation
│   └── utils/                    # Utilities
│       ├── docker-client.ts      # Dockerode wrapper
│       ├── logger.ts             # Logging
│       ├── cache.ts              # Caching
│       └── compose-exec.ts       # Compose exec helper
├── tests/
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
└── docs/                         # Documentation
```

### Key Technologies

- **TypeScript** — Type-safe codebase
- **Dockerode** — Docker API client
- **MCP SDK** — Model Context Protocol
- **Vitest** — Testing framework
- **YAML** — Compose file parsing

---

## 🔧 Development Workflow

### Making Changes

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Follow TypeScript best practices
   - Add tests for new features
   - Update documentation

3. **Run tests**
   ```bash
   npm test
   npm run test:coverage
   ```

4. **Build and verify**
   ```bash
   npm run build
   npm start  # Test locally
   ```

5. **Submit PR**
   - Describe changes
   - Reference related issues
   - Ensure CI passes

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Use meaningful variable names

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              MCP Client (Cursor/Claude)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              MCP Server (index.ts)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Container    │  │ Database     │  │ Environment  │ │
│  │ Tools        │  │ Tools        │  │ Tools        │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Container    │ │ Adapter      │ │ Project      │
│ Manager      │ │ Registry     │ │ Discovery    │
└──────────────┘ └──────────────┘ └──────────────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
            ┌─────────────────┐
            │  Docker Engine  │
            └─────────────────┘
```

### Layer Responsibilities

- **Tools Layer** — MCP command handlers, request validation
- **Managers Layer** — Business logic, Docker operations
- **Adapters Layer** — Database-specific implementations
- **Discovery Layer** — Project structure detection
- **Utils Layer** — Shared utilities (logging, caching)

---

## 📖 Key Concepts

### Project Discovery

Automatically finds and parses `docker-compose.yml` files:

- Searches current directory and parents
- Supports multiple compose files
- Merges configurations intelligently
- Caches results for performance

### Database Adapters

Extensible pattern for database support:

- `DatabaseAdapter` interface
- Registry pattern for registration
- Type detection from compose config
- Command execution via containers

### Security

- Automatic secrets masking (PASSWORD, TOKEN, KEY, etc.)
- Optional SQL validation
- Safe command execution
- Environment variable sanitization

---

## 🧪 Testing Strategy

### Unit Tests

- Test individual functions and classes
- Mock external dependencies (Docker, file system)
- Fast execution (< 1 second)

### Integration Tests

- Test component interactions
- Use real Docker API (requires Docker)
- Test actual compose file parsing

### E2E Tests

- Test full command workflows
- Verify MCP protocol compliance
- Test with real Docker containers

---

## 🐛 Debugging

### Enable Debug Logging

```bash
DEBUG=* npm run dev
```

### Common Issues

1. **Docker not running**
   - Ensure Docker Desktop is running
   - Check `docker ps` works

2. **Compose file not found**
   - Check current directory
   - Verify `docker-compose.yml` exists

3. **Database adapter not found**
   - Check adapter registration in `index.ts`
   - Verify database type detection

---

## 📝 Contributing Guidelines

### Adding a New Command

1. Create tool in `src/tools/your-tool.ts`
2. Implement MCP tool interface
3. Add to server registration in `index.ts`
4. Write tests
5. Update documentation

### Adding a New Database Adapter

1. Create adapter in `src/adapters/your-db.ts`
2. Implement `DatabaseAdapter` interface
3. Register in `src/adapters/adapter-registry.ts`
4. Add tests
5. Update `DATABASE_ADAPTERS.md`

### Code Review Checklist

- [ ] Code follows TypeScript best practices
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Performance considered

---

## 🔗 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Dockerode Documentation](https://github.com/apocas/dockerode)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)

---

## 📞 Getting Help

- **GitHub Issues** — Bug reports and feature requests
- **GitHub Discussions** — Questions and discussions
- **Code Review** — Ask in PR comments

---

**Happy Coding! 🚀**

