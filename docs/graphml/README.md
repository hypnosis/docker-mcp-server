# GraphML Diagrams

> GraphML files for system architecture visualization

## 📊 Available Diagrams

### architecture.graphml

Architecture diagram of Docker MCP Server showing:
- All system components
- Connections between modules
- Data flows
- Dependency types

## 🛠️ Viewing Diagrams

### Option 1: yEd Graph Editor (Recommended)

1. Download yEd: https://www.yworks.com/products/yed
2. Open file `architecture.graphml`
3. Select layout: `Hierarchical` or `Organic`
4. Export to PNG/PDF

### Option 2: Graphviz (if supports GraphML)

```bash
# Install graphviz
brew install graphviz  # Mac
sudo apt-get install graphviz  # Linux

# Convert (if supported)
dot -Tpng architecture.graphml -o architecture.png
```

### Option 3: Online Editors

- **GraphML Editor:** https://graphml.graphdrawing.org/editor.html
- **draw.io:** Import GraphML (experimental)
- **yEd Live:** https://www.yworks.com/yed-live/

### Option 4: VS Code Extension

1. Install "GraphML Preview" extension
2. Open `.graphml` file
3. Use Preview panel

## 📝 Diagram Structure

### Nodes

- **Client Layer:** MCP Client (Cursor/Claude)
- **Server Layer:** MCP Server (index.ts)
- **Discovery:** Project Discovery, Compose Parser, Config Merger
- **Client:** Dockerode Client
- **Managers:** Container, Compose, Environment Managers
- **Adapters:** PostgreSQL, Redis, SQLite Adapters
- **Security:** Secrets Masker, SQL Validator
- **Tools:** Container, Database, Environment, Executor Tools
- **External:** Docker Engine
- **Utilities:** Logger, Cache

### Edges

Connection types:
- **protocol:** MCP Protocol
- **registration:** Tool registration
- **dependency:** Module usage
- **management:** Adapter management
- **execution:** Command execution
- **api:** Docker API
- **logging:** Logging
- **optional:** Optional dependency

## 🔄 Updating Diagram

When changing architecture:

1. Open `architecture.graphml` in yEd
2. Add/remove nodes/edges
3. Update styles if needed
4. Save file
5. Export to PNG for documentation (optional)

## 📚 Related Documents

- [Developer Architecture](../DEVELOPER_ARCHITECTURE.md) — Detailed architecture
- [Architecture](../ARCHITECTURE.md) — General architecture
- [Sprints](../sprints/SPRINTS.md) — Development plan

---

**Updated:** 2025-01-01 (Sprint 3)
