/**
 * Universal Executor Tool
 * Execute any commands in container via docker exec
 */

import { Tool, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';

export class ExecutorTool {
  private containerManager: ContainerManager;
  private projectDiscovery: ProjectDiscovery;

  constructor() {
    this.containerManager = new ContainerManager();
    this.projectDiscovery = new ProjectDiscovery();
  }

  getTool(): Tool {
    return {
      name: 'docker_exec',
      description: 'Execute any command in a container. Examples: "npm test", "pytest tests/", "alembic upgrade head", "python manage.py migrate"',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Service name from docker-compose.yml',
          },
          command: {
            type: 'string',
            description: 'Command to execute (e.g., "npm test", "pytest tests/", "alembic upgrade head")',
          },
          user: {
            type: 'string',
            description: 'Run as specific user (optional)',
          },
          workdir: {
            type: 'string',
            description: 'Working directory (optional)',
          },
          project: {
            type: 'string',
            description: 'Project name (auto-detected if not provided)',
          },
          interactive: {
            type: 'boolean',
            description: 'Interactive mode (TTY) for REPL, bash, etc.',
            default: false,
          },
        },
        required: ['service', 'command'],
      },
    };
  }

  async handleCall(request: CallToolRequest): Promise<any> {
    const args = request.params.arguments as {
      service?: string;
      command?: string;
      project?: string;
      user?: string;
      workdir?: string;
      interactive?: boolean;
    };

    try {
      if (!args || !args.service || !args.command) {
        throw new Error('service and command parameters are required');
      }

      const project = await this.projectDiscovery.findProject(
        args.project ? { explicitProjectName: args.project } : {}
      );
      
      // Parse command string to array
      const commandParts = this.parseCommand(args.command);
      
      logger.info(`Executing in ${args.service}: ${args.command}`);

      const output = await this.containerManager.exec(
        args.service,
        project.name,
        commandParts,
        {
          user: args.user,
          workdir: args.workdir,
          interactive: args.interactive || false,
        },
        project.composeFile,
        project.projectDir
      );

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error: any) {
      logger.error('docker_exec failed:', error);
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

  /**
   * Simple parsing of command string → array
   * TODO: improve for quoted strings in the future
   */
  private parseCommand(command: string): string[] {
    // Simple split by spaces
    // In the future, can add support for quoted strings
    return command.split(' ').filter((s) => s.length > 0);
  }
}