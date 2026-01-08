# Remote Docker Support

> SSH-based remote Docker management with Docker MCP Server

## Overview

Docker MCP Server supports connecting to remote Docker hosts via SSH. This allows you to manage Docker containers, run docker-compose commands, and execute operations on remote servers — all through your local AI assistant.

**Key Features:**
- ✅ SSH key-based authentication
- ✅ Multiple server profiles (production, staging, etc.)
- ✅ Automatic retry with exponential backoff
- ✅ Timeout handling (30s default)
- ✅ Full compatibility with all MCP commands
- ✅ Secure credential management

---

## Quick Start

### 1. Basic Setup (Single Server)

Add SSH configuration to your MCP config:

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"],
      "env": {
        "DOCKER_SSH_HOST": "example.com",
        "DOCKER_SSH_USER": "deployer",
        "DOCKER_SSH_KEY": "/Users/me/.ssh/id_rsa",
        "DOCKER_SSH_PORT": "22"
      }
    }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"],
      "env": {
        "DOCKER_SSH_HOST": "example.com",
        "DOCKER_SSH_USER": "deployer",
        "DOCKER_SSH_KEY": "/Users/me/.ssh/id_rsa"
      }
    }
  }
}
```

### 2. Multiple Servers (Profiles File) — Recommended

To manage multiple remote Docker servers elegantly, use a **profiles configuration file**:

**Step 1:** Create `~/.docker-mcp/profiles.json`:

```json
{
  "default": "production",
  "profiles": {
    "production": {
      "host": "prod.example.com",
      "username": "deployer",
      "port": 22,
      "privateKeyPath": "~/.ssh/id_rsa_prod"
    },
    "staging": {
      "host": "staging.example.com",
      "username": "deployer",
      "port": 2222,
      "privateKeyPath": "~/.ssh/id_rsa_staging"
    },
    "development": {
      "host": "dev.example.com",
      "username": "developer",
      "port": 22
    }
  }
}
```

**Step 2:** Configure MCP to use the profiles file:

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@hypnosis/docker-mcp-server"],
      "env": {
        "DOCKER_MCP_PROFILES_FILE": "~/.docker-mcp/profiles.json"
      }
    }
  }
}
```

**Benefits:**
- ✅ Clean JSON without escaping
- ✅ Easy to edit and maintain
- ✅ Default profile support
- ✅ Can override profile via `DOCKER_SSH_PROFILE` env var

**To switch servers**, either:
1. Change `"default"` in profiles.json
2. Add `"DOCKER_SSH_PROFILE": "staging"` to MCP env

### 3. Using Cursor Secrets (For Sensitive Data)

For storing SSH passphrases or passwords, use **Cursor Secrets**:

1. Open Cursor Settings → **Secrets**
2. Add secrets for sensitive data:
   - `DOCKER_SSH_PASSPHRASE`: `your-key-passphrase` (if SSH key is encrypted)
   - `DOCKER_SSH_PASSWORD`: `your-ssh-password` (if using password auth)

3. These are automatically injected as environment variables

**Note:** Profiles file (`~/.docker-mcp/profiles.json`) is recommended for server configurations. Use Cursor Secrets only for truly sensitive data like passwords and passphrases.

---

## Configuration Options

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DOCKER_MCP_PROFILES_FILE` | No | Path to profiles JSON file | `~/.docker-mcp/profiles.json` |
| `DOCKER_SSH_PROFILE` | No | Override active profile | `staging` |
| `DOCKER_SSH_HOST` | Yes* | Remote server hostname or IP | `prod.example.com` |
| `DOCKER_SSH_USER` | Yes* | SSH username | `deployer` |
| `DOCKER_SSH_PORT` | No | SSH port (default: 22) | `2222` |
| `DOCKER_SSH_KEY` | Recommended | Path to SSH private key | `/Users/me/.ssh/id_rsa` |
| `DOCKER_SSH_PASSPHRASE` | No | Passphrase for encrypted SSH key | `secret123` |
| `DOCKER_SSH_PASSWORD` | No | SSH password (not recommended) | - |

*Required if `DOCKER_MCP_PROFILES_FILE` is not set

### Configuration Priority

1. **Profiles File** (`DOCKER_MCP_PROFILES_FILE`) — Recommended
2. **Environment Variables** (`DOCKER_SSH_HOST`, `DOCKER_SSH_USER`, etc.) — Simple single server
3. **JSON in Env** (`DOCKER_SSH_PROFILES`) — Legacy, not recommended

### Aliases

For convenience, these variables are also supported:
- `DOCKER_SSH_USERNAME` → `DOCKER_SSH_USER`
- `DOCKER_SSH_PRIVATE_KEY` → `DOCKER_SSH_KEY`
- `DOCKER_SSH_KEY_PATH` → `DOCKER_SSH_KEY`

---

## SSH Key Setup

### 1. Generate SSH Key (if needed)

```bash
ssh-keygen -t ed25519 -C "docker-mcp-server" -f ~/.ssh/id_rsa_docker
```

### 2. Copy Public Key to Remote Server

```bash
ssh-copy-id -i ~/.ssh/id_rsa_docker.pub deployer@example.com
```

Or manually:
```bash
cat ~/.ssh/id_rsa_docker.pub | ssh deployer@example.com "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3. Test SSH Connection

```bash
ssh -i ~/.ssh/id_rsa_docker deployer@example.com
```

### 4. Verify Docker Access

On the remote server:
```bash
docker ps
docker-compose --version
```

---

## Security Best Practices

### ✅ Recommended

1. **Use SSH Keys, Not Passwords**
   - More secure
   - Supports passphrase-protected keys
   - Better for automation

2. **Use Cursor Secrets**
   - Never commit credentials to Git
   - Centralized secret management
   - Automatic encryption

3. **Restrict SSH Key Permissions**
   ```bash
   chmod 600 ~/.ssh/id_rsa_docker
   chmod 644 ~/.ssh/id_rsa_docker.pub
   ```

4. **Use Separate Keys for Different Servers**
   - Production: `~/.ssh/id_rsa_prod`
   - Staging: `~/.ssh/id_rsa_staging`
   - Development: `~/.ssh/id_rsa_dev`

5. **Restrict SSH User Permissions on Server**
   - Use dedicated deployment user (not root)
   - Limit sudo access if needed
   - Use Docker group membership instead of root

### ❌ Not Recommended

1. **Storing Credentials in Config Files**
   - Risk of Git commits
   - No encryption
   - Difficult to rotate

2. **Using SSH Passwords**
   - Less secure
   - Requires manual entry
   - Not suitable for automation

3. **Sharing Keys Across Environments**
   - Security risk
   - Difficult to revoke access
   - No audit trail

---

## Usage Examples

### Container Management

All container commands work with remote Docker:

```typescript
// List containers on remote server
docker_container_list()

// Start a service
docker_container_start("web")

// View logs
docker_container_logs("web", {follow: true, lines: 100})

// Restart service
docker_container_restart("web")
```

### Docker Compose

docker-compose commands automatically use remote Docker:

```typescript
// Start entire stack
docker_compose_up({build: true})

// Stop stack
docker_compose_down({volumes: false})

// Scale services
docker_compose_up({scale: {web: 3, worker: 2}})
```

### Database Operations

Database commands work with remote databases:

```typescript
// Query remote PostgreSQL
docker_db_query("postgres", "SELECT * FROM users LIMIT 10;")

// Create backup
docker_db_backup("postgres", "./backups/prod-backup.sql")

// Check database status
docker_db_status("postgres")
```

### Command Execution

Execute commands in remote containers:

```typescript
// Run tests
docker_exec("web", "npm test")

// Run migrations
docker_exec("api", "python manage.py migrate")

// Check disk usage
docker_exec("worker", "df -h")
```

---

## Retry & Timeout

### Automatic Retry

The server automatically retries failed operations:
- **Max attempts**: 3
- **Initial delay**: 1 second
- **Backoff multiplier**: 2 (exponential: 1s, 2s, 4s)
- **Timeout**: 30 seconds per operation

### Retry Triggers

Retries are triggered for:
- Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- Connection timeouts
- Temporary SSH connection failures

### Not Retried

These errors are NOT retried:
- Authentication failures (400, 401, 403)
- Validation errors
- Permission denied

---

## Troubleshooting

### Connection Failed

**Error**: `Failed to connect to remote Docker at example.com`

**Solutions:**
1. Verify SSH connection works:
   ```bash
   ssh -i ~/.ssh/id_rsa deployer@example.com
   ```

2. Check Docker is running on remote server:
   ```bash
   ssh deployer@example.com "docker ps"
   ```

3. Verify SSH key path is correct:
   - Check `DOCKER_SSH_KEY` points to correct file
   - Ensure file exists and has correct permissions (600)

4. Check SSH port:
   - Default is 22
   - Verify with `DOCKER_SSH_PORT` if using custom port

### Authentication Failed

**Error**: `Permission denied (publickey)`

**Solutions:**
1. Verify public key is on remote server:
   ```bash
   ssh deployer@example.com "cat ~/.ssh/authorized_keys"
   ```

2. Check SSH key permissions:
   ```bash
   chmod 600 ~/.ssh/id_rsa
   ```

3. For passphrase-protected keys:
   - Use `DOCKER_SSH_PASSPHRASE` environment variable
   - Or load key into SSH agent: `ssh-add ~/.ssh/id_rsa`

### Docker Command Failed

**Error**: `docker-compose failed: ...`

**Solutions:**
1. Verify docker-compose is installed on remote server:
   ```bash
   ssh deployer@example.com "docker-compose --version"
   ```

2. Check user has Docker permissions:
   - User should be in `docker` group
   - Or use `sudo` (not recommended)

3. Verify docker-compose.yml exists on remote server
   - Same path as local project
   - Or update paths in configuration

### Timeout Errors

**Error**: `Operation timed out after 30000ms`

**Solutions:**
1. Check network connectivity:
   ```bash
   ping example.com
   ```

2. Verify SSH connection is stable:
   - Test with: `ssh -v deployer@example.com`
   - Check for connection drops

3. Increase timeout (requires code changes):
   - Current: 30 seconds
   - Can be adjusted in `src/utils/retry.ts`

### Profile Not Found

**Error**: `SSH profile "production" not found in DOCKER_SSH_PROFILES`

**Solutions:**
1. Verify profile name matches exactly (case-sensitive)
2. Check `DOCKER_SSH_PROFILES` JSON is valid:
   ```bash
   echo $DOCKER_SSH_PROFILES | jq .
   ```
3. Ensure profile exists in JSON object

---

## Architecture

### How It Works

```
┌─────────────────────────────────────────┐
│     MCP Server (Local Machine)          │
│                                          │
│  1. Load SSH Config from Env            │
│  2. Create DockerClient with SSH        │
│  3. Set DOCKER_HOST=ssh://user@host     │
└─────────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   SSH Tunnel    │
         └─────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Remote Docker Server               │
│                                          │
│  - Docker daemon (via socket)           │
│  - docker-compose CLI                   │
│  - Running containers                   │
└─────────────────────────────────────────┘
```

### Components

1. **SSH Config Module** (`src/utils/ssh-config.ts`)
   - Loads configuration from environment variables
   - Validates SSH settings
   - Manages profiles

2. **Docker Client** (`src/utils/docker-client.ts`)
   - Creates Dockerode client with SSH
   - Sets `DOCKER_HOST` environment variable
   - Handles retry logic

3. **Compose Exec** (`src/utils/compose-exec.ts`)
   - Executes docker-compose commands
   - Sets `DOCKER_HOST` for remote Docker
   - Supports Docker contexts

4. **Retry Utility** (`src/utils/retry.ts`)
   - Exponential backoff
   - Timeout handling
   - Network error detection

---

## Limitations

1. **Performance**: SSH adds latency (~50-200ms per command)
2. **SSH Agent**: Passphrase-protected keys should be loaded in SSH agent
3. **Docker Context**: Docker contexts must be created manually (if used)
4. **File Paths**: Relative paths in docker-compose.yml must exist on remote server
5. **Network**: Requires stable network connection for real-time operations

---

## Advanced Configuration

### Docker Context (Alternative to DOCKER_HOST)

Instead of using `DOCKER_HOST`, you can create a Docker context:

```bash
# Create context
docker context create remote-prod \
  --docker "host=ssh://deployer@prod.example.com"

# Use in compose-exec
# (requires manual implementation)
```

### Custom Retry Configuration

Modify retry settings in `src/utils/retry.ts`:

```typescript
await retryWithTimeout(fn, {
  maxAttempts: 5,        // Increase attempts
  timeout: 60000,        // 60 seconds timeout
  initialDelay: 2000,    // 2 seconds initial delay
  backoffMultiplier: 1.5 // Slower backoff
});
```

### SSH Config File

You can use `~/.ssh/config` for SSH settings:

```
Host prod-docker
  HostName prod.example.com
  User deployer
  Port 22
  IdentityFile ~/.ssh/id_rsa_prod
  IdentitiesOnly yes
```

Then use in `DOCKER_SSH_HOST`: `prod-docker`

---

## Migration from Local to Remote

### Step 1: Setup SSH Access
- Generate SSH key
- Copy to remote server
- Test connection

### Step 2: Configure MCP Server
- Add SSH environment variables
- Or use Cursor Secrets

### Step 3: Verify Connection
- Restart Cursor/Claude Desktop
- Check logs for "SSH configuration loaded"
- Test with `docker_container_list()`

### Step 4: Update Project Paths
- Ensure docker-compose.yml exists on remote server
- Update any absolute paths in docker-compose.yml
- Verify relative paths work

---

## FAQ

**Q: Can I use both local and remote Docker?**  
A: No, only one at a time. Set SSH config for remote, leave empty for local.

**Q: Do I need Docker installed locally?**  
A: No, but you need SSH client and Docker on the remote server.

**Q: Can I use password authentication?**  
A: Yes, but not recommended. Use `DOCKER_SSH_PASSWORD` environment variable.

**Q: How do I switch between servers?**  
A: Change `DOCKER_SSH_PROFILE` or update SSH config variables.

**Q: Does it work with Docker Swarm?**  
A: Yes, if the remote Docker is a Swarm manager, commands will work.

**Q: Can I use this with CI/CD?**  
A: Yes, set SSH environment variables in CI/CD secrets.

---

## Related Documentation

- [API Reference](./API_REFERENCE.md) - Full command reference
- [Examples](./EXAMPLES.md) - Usage examples
- [Architecture](./ARCHITECTURE.md) - System architecture
- [Setup Instructions](./SETUP_INSTRUCTIONS.md) - Initial setup

---

**Last Updated**: 2026-01-08  
**Version**: 1.1.0

