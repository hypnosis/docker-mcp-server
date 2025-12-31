/**
 * Container Tools
 * MCP Tools для управления Docker контейнерами
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';

export class ContainerTools {
  private containerManager: ContainerManager;
  private projectDiscovery: ProjectDiscovery;

  constructor() {
    this.containerManager = new ContainerManager();
    this.projectDiscovery = new ProjectDiscovery();
  }

  /**
   * Регистрация всех container tools
   */
  getTools(): Tool[] {
    return [
      {
        name: 'docker_container_list',
        description: 'List all containers in the current project',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
          },
        },
      },
      {
        name: 'docker_container_start',
        description: 'Start a stopped container',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Service name from docker-compose.yml',
            },
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
          },
          required: ['service'],
        },
      },
      {
        name: 'docker_container_stop',
        description: 'Stop a running container',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Service name from docker-compose.yml',
            },
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in seconds',
              default: 10,
            },
          },
          required: ['service'],
        },
      },
      {
        name: 'docker_container_restart',
        description: 'Restart a container',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Service name from docker-compose.yml',
            },
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in seconds',
              default: 10,
            },
          },
          required: ['service'],
        },
      },
      {
        name: 'docker_container_logs',
        description: 'View container logs',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Service name from docker-compose.yml',
            },
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            lines: {
              type: 'number',
              description: 'Number of lines to show',
              default: 100,
            },
            timestamps: {
              type: 'boolean',
              description: 'Show timestamps',
              default: false,
            },
          },
          required: ['service'],
        },
      },
    ];
  }

  /**
   * Обработка вызова tool
   */
  async handleCall(request: CallToolRequest): Promise<any> {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'docker_container_list':
          return await this.handleList(args);
        
        case 'docker_container_start':
          return await this.handleStart(args);
        
        case 'docker_container_stop':
          return await this.handleStop(args);
        
        case 'docker_container_restart':
          return await this.handleRestart(args);
        
        case 'docker_container_logs':
          return await this.handleLogs(args);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      logger.error(`Tool ${name} failed:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleList(args: any) {
    const project = await this.getProject(args?.project);
    const containers = await this.containerManager.listContainers(project.name);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(containers, null, 2),
        },
      ],
    };
  }

  private async handleStart(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const project = await this.getProject(args?.project);
    await this.containerManager.startContainer(args.service, project.name);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Container '${args.service}' started successfully`,
        },
      ],
    };
  }

  private async handleStop(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const project = await this.getProject(args?.project);
    await this.containerManager.stopContainer(
      args.service,
      project.name,
      args?.timeout || 10
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Container '${args.service}' stopped successfully`,
        },
      ],
    };
  }

  private async handleRestart(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const project = await this.getProject(args?.project);
    await this.containerManager.restartContainer(
      args.service,
      project.name,
      args?.timeout || 10
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Container '${args.service}' restarted successfully`,
        },
      ],
    };
  }

  private async handleLogs(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const project = await this.getProject(args?.project);
    const logs = await this.containerManager.getLogs(args.service, project.name, {
      lines: args?.lines || 100,
      timestamps: args?.timestamps || false,
    });

    return {
      content: [
        {
          type: 'text',
          text: logs,
        },
      ],
    };
  }

  /**
   * Helper: получить project config (auto-detect или explicit)
   */
  private async getProject(explicitName?: string) {
    // Пока используем auto-detect всегда
    // В будущем можно добавить кеширование по explicit name
    return this.projectDiscovery.findProject();
  }
}