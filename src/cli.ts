#!/usr/bin/env node
/**
 * CLI Interface for Docker MCP Server
 * Allows direct command execution without MCP protocol
 */

import { ContainerTools } from './tools/container-tools.js';
import { ExecutorTool } from './tools/executor-tool.js';
import { DatabaseTools } from './tools/database-tools.js';
import { EnvTools } from './tools/env-tools.js';
import { MCPHealthTool } from './tools/mcp-health-tool.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  showHelp();
  process.exit(0);
}

const command = args[0];

async function main() {
  try {
    switch (command) {
      // Container commands
      case 'container-list':
      case 'ps':
        await containerList();
        break;
      
      case 'container-start':
        await containerStart(args[1]);
        break;
      
      case 'container-stop':
        await containerStop(args[1]);
        break;
      
      case 'container-restart':
        await containerRestart(args[1]);
        break;
      
      case 'container-logs':
      case 'logs':
        await containerLogs(args[1], parseLogsOptions(args.slice(2)));
        break;
      
      case 'compose-up':
      case 'up':
        await composeUp();
        break;
      
      case 'compose-down':
      case 'down':
        await composeDown();
        break;
      
      // Executor
      case 'exec':
        await exec(args[1], args.slice(2).join(' '));
        break;
      
      // Database
      case 'db-query':
        await dbQuery(args[1], args.slice(2).join(' '));
        break;
      
      case 'db-backup':
        await dbBackup(args[1], args[2]);
        break;
      
      case 'db-restore':
        await dbRestore(args[1], args[2]);
        break;
      
      case 'db-status':
        await dbStatus(args[1]);
        break;
      
      // Environment
      case 'env-list':
      case 'env':
        await envList();
        break;
      
      case 'compose-config':
      case 'config':
        await composeConfig();
        break;
      
      case 'healthcheck':
      case 'health':
        await healthcheck();
        break;
      
      // MCP Health
      case 'mcp-health':
        await mcpHealth();
        break;
      
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "docker-mcp-server help" for usage');
        process.exit(1);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Container commands
async function containerList() {
  const tools = new ContainerTools();
  const result = await tools.handleCall({
    method: 'tools/call',
    params: { name: 'docker_container_list', arguments: {} }
  } as any);
  console.log(result.content[0].text);
}

async function containerStart(service: string) {
  if (!service) {
    console.error('Error: service name required');
    process.exit(1);
  }
  const tools = new ContainerTools();
  const result = await tools.handleCall({
    params: { name: 'docker_container_start', arguments: { service } }
  } as any);
  console.log(result.content[0].text);
}

async function containerStop(service: string) {
  if (!service) {
    console.error('Error: service name required');
    process.exit(1);
  }
  const tools = new ContainerTools();
  const result = await tools.handleCall({
    params: { name: 'docker_container_stop', arguments: { service } }
  } as any);
  console.log(result.content[0].text);
}

async function containerRestart(service: string) {
  if (!service) {
    console.error('Error: service name required');
    process.exit(1);
  }
  const tools = new ContainerTools();
  const result = await tools.handleCall({
    params: { name: 'docker_container_restart', arguments: { service } }
  } as any);
  console.log(result.content[0].text);
}

async function containerLogs(service: string, options: any) {
  if (!service) {
    console.error('Error: service name required');
    process.exit(1);
  }
  const tools = new ContainerTools();
  const result = await tools.handleCall({
    params: { 
      name: 'docker_container_logs', 
      arguments: { 
        service,
        ...options
      } 
    }
  } as any);
  console.log(result.content[0].text);
}

async function composeUp() {
  const tools = new ContainerTools();
  const result = await tools.handleCall({
    params: { name: 'docker_compose_up', arguments: { detach: true } }
  } as any);
  console.log(result.content[0].text);
}

async function composeDown() {
  const tools = new ContainerTools();
  const result = await tools.handleCall({
    params: { name: 'docker_compose_down', arguments: {} }
  } as any);
  console.log(result.content[0].text);
}

// Executor
async function exec(service: string, command: string) {
  if (!service || !command) {
    console.error('Error: service and command required');
    process.exit(1);
  }
  const tool = new ExecutorTool();
  const result = await tool.handleCall({
    params: { name: 'docker_exec', arguments: { service, command } }
  } as any);
  console.log(result.content[0].text);
}

// Database
async function dbQuery(service: string, query: string) {
  if (!service || !query) {
    console.error('Error: service and query required');
    process.exit(1);
  }
  const tools = new DatabaseTools();
  const result = await tools.handleCall({
    params: { name: 'docker_db_query', arguments: { service, query } }
  } as any);
  console.log(result.content[0].text);
}

async function dbBackup(service: string, output: string) {
  if (!service) {
    console.error('Error: service name required');
    process.exit(1);
  }
  const tools = new DatabaseTools();
  const result = await tools.handleCall({
    params: { name: 'docker_db_backup', arguments: { service, output } }
  } as any);
  console.log(result.content[0].text);
}

async function dbRestore(service: string, backupPath: string) {
  if (!service || !backupPath) {
    console.error('Error: service and backup path required');
    process.exit(1);
  }
  const tools = new DatabaseTools();
  const result = await tools.handleCall({
    params: { name: 'docker_db_restore', arguments: { service, backupPath } }
  } as any);
  console.log(result.content[0].text);
}

async function dbStatus(service: string) {
  if (!service) {
    console.error('Error: service name required');
    process.exit(1);
  }
  const tools = new DatabaseTools();
  const result = await tools.handleCall({
    params: { name: 'docker_db_status', arguments: { service } }
  } as any);
  console.log(result.content[0].text);
}

// Environment
async function envList() {
  const tools = new EnvTools();
  const result = await tools.handleCall({
    params: { name: 'docker_env_list', arguments: { maskSecrets: true } }
  } as any);
  console.log(result.content[0].text);
}

async function composeConfig() {
  const tools = new EnvTools();
  const result = await tools.handleCall({
    params: { name: 'docker_compose_config', arguments: {} }
  } as any);
  console.log(result.content[0].text);
}

async function healthcheck() {
  const tools = new EnvTools();
  const result = await tools.handleCall({
    params: { name: 'docker_healthcheck', arguments: {} }
  } as any);
  console.log(result.content[0].text);
}

// MCP Health
async function mcpHealth() {
  const tool = new MCPHealthTool();
  const result = await tool.handleCall({
    params: { name: 'docker_mcp_health', arguments: {} }
  } as any);
  console.log(result.content[0].text);
}

// Helpers
function parseLogsOptions(args: string[]): any {
  const options: any = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lines' || args[i] === '-n') {
      options.lines = parseInt(args[++i]);
    } else if (args[i] === '--follow' || args[i] === '-f') {
      options.follow = true;
    } else if (args[i] === '--timestamps' || args[i] === '-t') {
      options.timestamps = true;
    }
  }
  return options;
}

function showHelp() {
  console.log(`
Docker MCP Server CLI v1.0.0

Usage: docker-mcp-server <command> [options]

CONTAINER COMMANDS:
  ps, container-list              List all containers
  container-start <service>       Start a container
  container-stop <service>        Stop a container
  container-restart <service>     Restart a container
  logs <service> [options]        View container logs
    --lines, -n <number>          Number of lines to show
    --follow, -f                  Follow log output
    --timestamps, -t              Show timestamps

COMPOSE COMMANDS:
  up, compose-up                  Start all services
  down, compose-down              Stop all services
  config, compose-config          Show compose configuration

EXECUTOR:
  exec <service> <command>        Execute command in container

DATABASE COMMANDS:
  db-query <service> <query>      Execute database query
  db-backup <service> [output]    Backup database
  db-restore <service> <path>     Restore database
  db-status <service>             Show database status

ENVIRONMENT:
  env, env-list                   List environment variables
  health, healthcheck             Check services health

OTHER:
  mcp-health                      Check MCP server health
  help                            Show this help

Examples:
  docker-mcp-server ps
  docker-mcp-server logs web --lines 50 --follow
  docker-mcp-server exec python "python --version"
  docker-mcp-server db-query postgres "SELECT * FROM users LIMIT 5"
  docker-mcp-server up
`);
}

main();

