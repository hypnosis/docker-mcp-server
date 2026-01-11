#!/usr/bin/env node
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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './utils/logger.js';
import { getDockerClientForProfile, cleanupAllDockerClients } from './utils/docker-client.js';
import { getAvailableProfiles, getDefaultProfile } from './utils/profile-resolver.js';
import { workspaceManager } from './utils/workspace.js';
import { ContainerTools } from './tools/container-tools.js';
import { ExecutorTool } from './tools/executor-tool.js';
import { DatabaseTools } from './tools/database-tools.js';
import { EnvTools } from './tools/env-tools.js';
import { MCPHealthTool } from './tools/mcp-health-tool.js';
import { ProfileTool } from './tools/profile-tool.js';
import { DiscoveryTools } from './tools/discovery-tools.js';

async function main() {
  // If command line arguments exist, use CLI mode
  if (process.argv.length > 2) {
    // CLI mode is handled in cli.ts
    console.error('Use "docker-mcp-server-cli" for CLI mode or run without arguments for MCP mode');
    process.exit(1);
  }

  // Get version from package.json
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version || '1.0.0';
  logger.info(`Starting Docker MCP Server v${version}`);

  // Load profiles from DOCKER_PROFILES ENV (happens at module import)
  const profiles = getAvailableProfiles();
  const defaultProfile = getDefaultProfile();
  logger.info(`Loaded ${profiles.length} profiles from DOCKER_PROFILES (default: ${defaultProfile})`);

  // Docker check (local only at startup, remote connections happen per-tool)
  try {
    const docker = getDockerClientForProfile(); // Local Docker (no profile)
    await docker.ping();
    logger.info('Local Docker connection: OK');
  } catch (error: any) {
    logger.error('Local Docker check failed:', error);
    process.exit(1);
  }

  // Initialize tools
  // Note: Database adapters are no longer registered as singletons
  // They are created per-request with proper dependency injection
  const containerTools = new ContainerTools();
  const executorTool = new ExecutorTool();
  const databaseTools = new DatabaseTools();
  const envTools = new EnvTools();
  const mcpHealthTool = new MCPHealthTool(); // SSH config resolved per-tool call
  const profileTool = new ProfileTool(); // Profiles loaded from DOCKER_PROFILES ENV
  const discoveryTools = new DiscoveryTools();

  // Create MCP Server
  const server = new Server(
    {
      name: 'docker-mcp-server',
      version: version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Setup workspace root from MCP client
  server.oninitialized = async () => {
    logger.info('MCP Server initialized, requesting workspace roots...');
    
    try {
      // Request workspace roots from client
      const clientCapabilities = server.getClientCapabilities();
      
      // Проверяем, поддерживает ли клиент roots
      if (clientCapabilities?.roots) {
        const rootsResult = await server.listRoots();
        
        if (rootsResult.roots && rootsResult.roots.length > 0) {
          // Используем первый root как workspace root
          const primaryRoot = rootsResult.roots[0];
          workspaceManager.setWorkspaceRoot(primaryRoot.uri);
          logger.info(`Using workspace root: ${primaryRoot.uri} (${primaryRoot.name || 'unnamed'})`);
        } else {
          logger.warn('No workspace roots provided by client, using process.cwd()');
        }
      } else {
        logger.warn('Client does not support roots capability, using process.cwd()');
      }
    } catch (error: any) {
      logger.error('Failed to get workspace roots:', error);
      logger.warn('Falling back to process.cwd()');
    }
  };

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('ListTools request received');
    
    const allTools = [
      ...containerTools.getTools(),
      executorTool.getTool(),
      ...databaseTools.getTools(),
      ...envTools.getTools(),
      mcpHealthTool.getTool(),
      profileTool.getTool(),
      ...discoveryTools.getTools(),
    ];
    
    logger.info(`Returning ${allTools.length} tools to MCP client`);
    logger.debug(`Tool names: ${allTools.map(t => t.name).join(', ')}`);
    
    return {
      tools: allTools,
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.debug('CallTool request:', request.params.name);

    const toolName = request.params.name;

    // Environment tools (check BEFORE docker_compose_ to catch docker_compose_config)
    if (toolName.startsWith('docker_env_') || toolName === 'docker_compose_config' || toolName === 'docker_healthcheck') {
      return envTools.handleCall(request);
    }

    // Container tools (including compose up/down commands and resource management)
    if (toolName.startsWith('docker_container_') || toolName === 'docker_compose_up' || toolName === 'docker_compose_down' || toolName === 'docker_resource_list') {
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

    // MCP Health tool
    if (toolName === 'docker_mcp_health') {
      return mcpHealthTool.handleCall(request);
    }

    // Profile tool
    if (toolName === 'docker_profile_info') {
      return profileTool.handleCall(request);
    }

    // Discovery tools
    if (toolName === 'docker_projects') {
      return discoveryTools.handleCall(request);
    }

    throw new Error(`Unknown tool: ${toolName}`);
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Docker MCP Server started successfully');
  
  // Calculate actual tool count
  const toolCount = 
    containerTools.getTools().length +
    1 + // executorTool
    databaseTools.getTools().length +
    envTools.getTools().length +
    1 + // mcpHealthTool
    1 + // profileTool
    discoveryTools.getTools().length;
  
  logger.info(`Registered tools: ${toolCount} commands (${containerTools.getTools().length} container + 1 executor + ${databaseTools.getTools().length} database + ${envTools.getTools().length} environment + 1 mcp-health + 1 profile + ${discoveryTools.getTools().length} discovery)`);
  logger.info('Listening on STDIO...');

  // Setup graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    // Cleanup all Docker clients (singleton + pool, SSH tunnels, etc.)
    try {
      cleanupAllDockerClients();
      logger.info('All Docker clients cleaned up');
    } catch (error: any) {
      logger.error('Error during Docker cleanup:', error.message);
    }
    
    // Close server transport
    try {
      await server.close();
      logger.info('MCP server closed');
    } catch (error: any) {
      logger.error('Error closing server:', error.message);
    }
    
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
  process.on('exit', () => {
    logger.debug('Process exiting, final cleanup...');
    cleanupAllDockerClients();
  });
}

// Error handling
main().catch((error) => {
  logger.error('Fatal error:', error);
  cleanupAllDockerClients(); // Cleanup on fatal error
  process.exit(1);
});