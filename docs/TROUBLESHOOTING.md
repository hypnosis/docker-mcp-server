# Troubleshooting Guide

Common issues and solutions when using Docker MCP Server.

---

## 🐳 Docker Issues

### Docker Not Running

**Problem:** Server fails to start with error about Docker connection.

**Symptoms:**
- Error: "Docker check failed"
- Error: "Cannot connect to Docker daemon"

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker ps
   ```

2. **Start Docker Desktop** (if using Docker Desktop)

3. **Check Docker socket:**
   - Linux: `/var/run/docker.sock`
   - macOS/Windows: Docker Desktop should handle this

4. **Verify permissions** (Linux):
   ```bash
   sudo usermod -aG docker $USER
   # Then logout and login again
   ```

### Docker Compose Not Found

**Problem:** Server can't find `docker-compose.yml` file.

**Symptoms:**
- Error: "No docker-compose.yml found"
- Commands fail with "project not found"

**Solutions:**

1. **Check current directory:**
   - Ensure you're in a directory with `docker-compose.yml`
   - Or in a subdirectory (server searches parent directories)

2. **Verify file name:**
   - Should be `docker-compose.yml` or `docker-compose.yaml`
   - Check for typos

3. **Check file permissions:**
   ```bash
   ls -la docker-compose.yml
   ```

4. **Multiple compose files:**
   - Server supports multiple compose files
   - They should be in same or parent directories

---

## 📦 Installation Issues

### npm Installation Fails

**Problem:** Can't install package from npm.

**Symptoms:**
- `npm install` fails
- Package not found error

**Solutions:**

1. **Check package name:**
   ```bash
   npm view @hypnosis/docker-mcp-server
   ```

2. **Update npm:**
   ```bash
   npm install -g npm@latest
   ```

3. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

4. **Try with npx:**
   ```bash
   npx @hypnosis/docker-mcp-server
   ```

### Permission Errors

**Problem:** Permission denied when installing globally.

**Symptoms:**
- Error: "EACCES: permission denied"
- Can't write to `/usr/local/lib/node_modules`

**Solutions:**

1. **Use npx (recommended):**
   - No global installation needed
   - Works with `npx @hypnosis/docker-mcp-server`

2. **Fix npm permissions:**
   ```bash
   # Option 1: Use a node version manager (recommended)
   # nvm, fnm, etc.

   # Option 2: Change npm default directory
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```

---

## ⚙️ Configuration Issues

### Cursor Not Finding MCP Server

**Problem:** Cursor doesn't recognize the MCP server.

**Symptoms:**
- MCP commands not available
- Server not listed in Cursor

**Solutions:**

1. **Check configuration file location:**
   - macOS/Linux: `~/.cursor/mcp.json` or `~/.config/cursor/mcp.json`
   - Windows: `%APPDATA%\Cursor\mcp.json`

2. **Verify JSON syntax:**
   ```json
   {
     "mcpServers": {
       "docker": {
         "command": "npx",
         "args": ["-y", "@hypnosis/docker-mcp-server"]
       }
     }
   }
   ```

3. **Restart Cursor** after configuration changes

4. **Check Cursor logs:**
   - Look for MCP-related errors in Cursor output

### Claude Desktop Not Finding MCP Server

**Problem:** Claude Desktop doesn't recognize the MCP server.

**Symptoms:**
- MCP commands not available
- Server not listed

**Solutions:**

1. **Check configuration file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Verify JSON syntax** (same as Cursor)

3. **Restart Claude Desktop** after configuration changes

4. **Check Node.js version:**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

---

## 🗄️ Database Issues

### Database Adapter Not Found

**Problem:** Can't execute database commands.

**Symptoms:**
- Error: "Database adapter not found for type X"
- Commands fail with adapter errors

**Solutions:**

1. **Check database type detection:**
   - Server detects database from `docker-compose.yml`
   - Verify service uses recognized image (postgres, redis, sqlite)

2. **Supported databases:**
   - PostgreSQL (postgres/postgresql)
   - Redis (redis)
   - SQLite (sqlite/sqlite3)

3. **Custom images:**
   - Adapter detection uses image name
   - If using custom image, ensure it contains database name

### Database Connection Errors

**Problem:** Can't connect to database container.

**Symptoms:**
- Error: "Container not found"
- Error: "Database connection failed"

**Solutions:**

1. **Check container is running:**
   ```bash
   docker ps | grep postgres
   ```

2. **Verify service name:**
   - Use exact service name from `docker-compose.yml`
   - Case-sensitive

3. **Check container health:**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}"
   ```

4. **Restart container:**
   ```bash
   docker-compose restart postgres
   ```

---

## 🔐 Environment Variable Issues

### Secrets Not Masked

**Problem:** Secrets visible in environment output.

**Symptoms:**
- Passwords/tokens shown in plain text
- `docker_env_list()` shows secrets

**Solutions:**

1. **Enable masking:**
   ```json
   {
     "env": {
       "DOCKER_MCP_MASK_SECRETS": "true"
     }
   }
   ```

2. **Masking keywords:**
   - `PASSWORD`, `TOKEN`, `KEY`, `SECRET`, `API_KEY`
   - Variables containing these are masked

3. **Check environment files:**
   - Server reads `.env` files
   - Ensure sensitive variables use keywords

### Environment Variables Not Found

**Problem:** Environment variables missing from output.

**Symptoms:**
- Empty environment list
- Missing expected variables

**Solutions:**

1. **Check `.env` files:**
   - `.env`, `.env.local`, `.env.development`
   - Server reads from compose file directory

2. **Verify compose config:**
   - Check `env_file` in `docker-compose.yml`
   - Check `environment` section

3. **Reload discovery:**
   - Restart MCP server
   - Or use `docker_compose_config()` to verify

---

## 📋 Command Execution Issues

### Commands Fail with "Container Not Found"

**Problem:** Can't find container by service name.

**Symptoms:**
- Error: "Container 'web' not found"
- Empty container list

**Solutions:**

1. **Check service name:**
   - Use exact name from `docker-compose.yml`
   - Not container name (may differ)

2. **List available containers:**
   ```bash
   docker_container_list()
   ```

3. **Verify project name:**
   - Server uses directory name as project name
   - Check discovery with `docker_compose_config()`

4. **Check containers are running:**
   ```bash
   docker ps
   ```

### Exec Commands Fail

**Problem:** `docker_exec()` commands don't work.

**Symptoms:**
- Error: "Command failed"
- No output from exec

**Solutions:**

1. **Check command syntax:**
   ```typescript
   // Correct
   docker_exec("web", "npm test")
   
   // Wrong (don't split command)
   docker_exec("web", ["npm", "test"])  // ❌
   ```

2. **Verify container has command:**
   - Some containers may not have commands installed
   - Check base image

3. **Check container is running:**
   - Exec only works on running containers

4. **Try with absolute path:**
   ```typescript
   docker_exec("web", "/usr/bin/node --version")
   ```

---

## 🔍 Debugging

### Enable Debug Logging

**For development/testing:**

```bash
# Set debug environment variable
export DEBUG=*

# Run server
npx @hypnosis/docker-mcp-server
```

### Check MCP Server Logs

**In Cursor:**
- Open Output panel
- Select "MCP" channel
- Look for error messages

**In Claude Desktop:**
- Check console output
- Look for MCP-related errors

### Verify Server is Running

```bash
# Test server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx @hypnosis/docker-mcp-server
```

---

## 🆘 Still Having Issues?

1. **Check GitHub Issues:**
   - Search for similar problems
   - Create new issue if needed

2. **Check Documentation:**
   - [FAQ](./FAQ.md) — Common questions
   - [API Reference](./API_REFERENCE.md) — Command details

3. **Get Help:**
   - GitHub Discussions
   - GitHub Issues

---

**Last Updated:** 2025-01-01

