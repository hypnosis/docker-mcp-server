# Docker MCP Server - Developer Documentation Index

> Complete navigation guide for all developer documentation

This index helps you quickly find the right documentation for your needs.

---

## 🎯 Quick Navigation by Role

### I'm Contributing Code

**Start here:**
1. [README.md](./README.md) — Development setup and workflow
2. [DEVELOPER_ARCHITECTURE.md](../DEVELOPER_ARCHITECTURE.md) — Code structure
3. [ARCHITECTURE.md](../ARCHITECTURE.md) — System design

**Then:**
- [API_REFERENCE.md](../API_REFERENCE.md) — Command implementations
- [DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md) — Why certain choices were made

### I'm Adding a Database Adapter

**Complete guide:**
1. [DATABASE_ADAPTERS.md](../DATABASE_ADAPTERS.md) — Step-by-step guide
2. Check existing adapters in `src/adapters/`
3. [API_REFERENCE.md](../API_REFERENCE.md) — Database command interface

### I'm Understanding the Architecture

**Read in order:**
1. [PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md) — High-level overview
2. [ARCHITECTURE.md](../ARCHITECTURE.md) — Technical design
3. [DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md) — Decision rationale
4. [DEVELOPER_ARCHITECTURE.md](../DEVELOPER_ARCHITECTURE.md) — Code organization

### I'm Debugging an Issue

**Start here:**
1. [README.md](./README.md) — Debugging section
2. Check relevant code in `src/`
3. [ARCHITECTURE.md](../ARCHITECTURE.md) — Understand data flow
4. Run tests to isolate issue

---

## 📚 Complete Documentation Map

### Core Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [README.md](./README.md) | Developer setup, workflow, guidelines | **Start here** |
| [DEVELOPER_ARCHITECTURE.md](../DEVELOPER_ARCHITECTURE.md) | Code structure and organization | Understanding codebase |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System design and patterns | Understanding design |
| [DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md) | Why certain choices were made | Understanding rationale |
| [PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md) | Complete project overview | Getting full picture |

### API & Implementation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [API_REFERENCE.md](../API_REFERENCE.md) | All 16 MCP commands | Implementing commands |
| [DATABASE_ADAPTERS.md](../DATABASE_ADAPTERS.md) | Creating database adapters | Adding database support |
| [EXAMPLES.md](../EXAMPLES.md) | Real-world usage examples | Understanding use cases |

### Reference

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [INDEX.md](../INDEX.md) | User documentation index | User documentation |
| [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) | Common issues | Debugging user issues |
| [FAQ.md](../FAQ.md) | Common questions | Answering questions |

---

## 🔍 Finding Information

### By Component

**Project Discovery:**
- `src/discovery/project-discovery.ts`
- [ARCHITECTURE.md](../ARCHITECTURE.md) — Discovery section

**Database Adapters:**
- `src/adapters/`
- [DATABASE_ADAPTERS.md](../DATABASE_ADAPTERS.md)

**Container Management:**
- `src/managers/container-manager.ts`
- `src/tools/container-tools.ts`
- [API_REFERENCE.md](../API_REFERENCE.md) — Container commands

**MCP Tools:**
- `src/tools/`
- [API_REFERENCE.md](../API_REFERENCE.md)

### By Task

**Adding a New Command:**
1. Check [README.md](./README.md) — Contributing guidelines
2. Look at existing tools in `src/tools/`
3. Implement MCP tool interface
4. Register in `src/index.ts`
5. Add tests
6. Update [API_REFERENCE.md](../API_REFERENCE.md)

**Adding a New Database:**
1. Read [DATABASE_ADAPTERS.md](../DATABASE_ADAPTERS.md)
2. Study existing adapter in `src/adapters/`
3. Implement `DatabaseAdapter` interface
4. Register in adapter registry
5. Add tests
6. Update documentation

**Understanding Discovery:**
1. [ARCHITECTURE.md](../ARCHITECTURE.md) — Discovery section
2. `src/discovery/project-discovery.ts`
3. `src/discovery/compose-parser.ts`
4. `src/discovery/config-merger.ts`

**Understanding Security:**
1. `src/security/sql-validator.ts`
2. `src/managers/env-manager.ts` — Secrets masking
3. [ARCHITECTURE.md](../ARCHITECTURE.md) — Security section

---

## 📖 Documentation Structure

```
docs/
├── DEV/                      # Developer documentation
│   ├── README.md            # Developer setup and workflow
│   └── INDEX.md             # This file
├── ARCHITECTURE.md          # System design
├── DEVELOPER_ARCHITECTURE.md # Code structure
├── DESIGN_DECISIONS.md      # Design rationale
├── API_REFERENCE.md         # Complete command reference
├── DATABASE_ADAPTERS.md     # Adapter creation guide
├── EXAMPLES.md              # Usage examples
├── PROJECT_SUMMARY.md       # High-level overview
├── TROUBLESHOOTING.md       # Common issues
├── FAQ.md                   # Frequently asked questions
└── INDEX.md                 # User documentation index
```

---

## 🚀 Getting Started

### New Contributors

1. **Setup:**
   - Read [README.md](./README.md) — Development setup
   - Clone repository
   - Install dependencies
   - Run tests

2. **Understand:**
   - [PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md) — What is this?
   - [ARCHITECTURE.md](../ARCHITECTURE.md) — How does it work?
   - [DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md) — Why was it built this way?

3. **Code:**
   - [DEVELOPER_ARCHITECTURE.md](../DEVELOPER_ARCHITECTURE.md) — Code structure
   - Study existing code
   - Start with small changes

### Experienced Developers

1. **Quick Start:**
   - [README.md](./README.md) — Setup
   - [ARCHITECTURE.md](../ARCHITECTURE.md) — Design overview
   - Start coding!

2. **Deep Dive:**
   - [DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md) — Understand choices
   - [DATABASE_ADAPTERS.md](../DATABASE_ADAPTERS.md) — If adding adapters
   - Code in `src/`

---

## 🔗 External Resources

- **Model Context Protocol:** https://modelcontextprotocol.io/
- **Dockerode Docs:** https://github.com/apocas/dockerode
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Vitest Docs:** https://vitest.dev/

---

## 📝 Documentation Maintenance

### Updating Documentation

When making changes:

1. **New Feature:**
   - Update [API_REFERENCE.md](../API_REFERENCE.md) if adding commands
   - Add examples to [EXAMPLES.md](../EXAMPLES.md)
   - Update [README.md](./README.md) if workflow changes
   - Document design in [DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md)

2. **Bug Fix:**
   - Update [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) if common issue
   - Update [FAQ.md](../FAQ.md) if answers question
   - Update affected docs

3. **Architecture Change:**
   - Update [ARCHITECTURE.md](../ARCHITECTURE.md)
   - Update [DESIGN_DECISIONS.md](../DESIGN_DECISIONS.md) with rationale
   - Update [DEVELOPER_ARCHITECTURE.md](../DEVELOPER_ARCHITECTURE.md)

---

**Last Updated:** 2025-01-01

