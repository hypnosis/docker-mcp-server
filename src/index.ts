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

async function main() {
  logger.info('Starting Docker MCP Server v0.1.0');

  // Проверка Docker
  try {
    const docker = getDockerClient();
    await docker.ping();
  } catch (error: any) {
    logger.error('Docker check failed:', error);
    process.exit(1);
  }

  // Инициализация tools
  const containerTools = new ContainerTools();
  const executorTool = new ExecutorTool();

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

    throw new Error(`Unknown tool: ${toolName}`);
  });

  // Подключение transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Docker MCP Server started successfully');
  logger.info('Registered tools: 6 commands');
  logger.info('Listening on STDIO...');
}

// Error handling
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});