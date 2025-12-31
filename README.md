# Docker MCP Server

Universal Docker MCP server for AI assistants (Cursor, Claude Desktop).

## 🚧 Status: Sprint 1 - In Development

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start
```

## Development

```bash
# Watch mode
npm run dev

# Clean build
npm run clean && npm run build
```

## Architecture

```
src/
├── index.ts                    # MCP Server entry point
├── tools/                      # MCP Tools Layer
│   ├── container-tools.ts      # Container commands
│   └── executor-tool.ts        # Universal executor
├── managers/                   # Business Logic
│   ├── container-manager.ts    # Docker containers
│   └── compose-manager.ts      # docker-compose (Sprint 2)
├── discovery/                  # Project Discovery
│   ├── project-discovery.ts    # Auto-detect compose files
│   ├── compose-parser.ts       # YAML parser
│   └── types.ts                # Type definitions
└── utils/                      # Utilities
    ├── docker-client.ts        # Dockerode wrapper
    └── logger.ts               # Logging
```

## License

MIT
