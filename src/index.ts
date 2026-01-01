/**
 * MCP Server Entry Point
 * Docker MCP Server for AI assistants (Cursor, Claude Desktop)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { getDockerClient } from './utils/docker-client.js';
import { ContainerTools } from './tools/container-tools.js';
import { ExecutorTool } from './tools/executor-tool.js';
import { DatabaseTools } from './tools/database-tools.js';
import { EnvTools } from './tools/env-tools.js';
import { MCPHealthTool } from './tools/mcp-health-tool.js';
import { adapterRegistry } from './adapters/adapter-registry.js';
import { PostgreSQLAdapter } from './adapters/postgresql.js';
import { RedisAdapter } from './adapters/redis.js';
import { SQLiteAdapter } from './adapters/sqlite.js';

async function main() {
  logger.info('Starting Docker MCP Server v1.0.0');

  // Проверка Docker
  try {
    const docker = getDockerClient();
    await docker.ping();
  } catch (error: any) {
    logger.error('Docker check failed:', error);
    process.exit(1);
  }

  // Регистрация Database Adapters
  adapterRegistry.register('postgresql', new PostgreSQLAdapter());
  adapterRegistry.register('postgres', new PostgreSQLAdapter()); // alias
  adapterRegistry.register('redis', new RedisAdapter());
  adapterRegistry.register('sqlite', new SQLiteAdapter());
  adapterRegistry.register('sqlite3', new SQLiteAdapter()); // alias
  logger.info('Database adapters registered: PostgreSQL, Redis, SQLite');

  // Инициализация tools
  const containerTools = new ContainerTools();
  const executorTool = new ExecutorTool();
  const databaseTools = new DatabaseTools();
  const envTools = new EnvTools();
  const mcpHealthTool = new MCPHealthTool();

  // Создание MCP Server
  const server = new Server(
    {
      name: 'docker-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Регистрация tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('ListTools request received');
    
    return {
      tools: [
        ...containerTools.getTools(),
        executorTool.getTool(),
        ...databaseTools.getTools(),
        ...envTools.getTools(),
        mcpHealthTool.getTool(),
      ],
    };
  });

  // Обработка вызовов
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.debug('CallTool request:', request.params.name);

    const toolName = request.params.name;

    // Container tools
    if (toolName.startsWith('docker_container_')) {
      return containerTools.handleCall(request);
    }

    // Executor tool
    if (toolName === 'docker_exec') {
      return executorTool.handleCall(request);
    }

    // Database tools
    if (toolName.startsWith('docker_db_')) {
      return databaseTools.handleCall(request);
    }

    // Environment tools
    if (toolName.startsWith('docker_env_') || toolName === 'docker_compose_config' || toolName === 'docker_healthcheck') {
      return envTools.handleCall(request);
    }

    // MCP Health tool
    if (toolName === 'docker_mcp_health') {
      return mcpHealthTool.handleCall(request);
    }

    throw new Error(`Unknown tool: ${toolName}`);
  });

  // Подключение transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Docker MCP Server started successfully');
  logger.info('Registered tools: 15 commands (6 container + 1 executor + 4 database + 3 environment + 1 mcp-health)');
  logger.info('Listening on STDIO...');
}

// Error handling
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});