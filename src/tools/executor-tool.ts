/**
 * Universal Executor Tool
 * Execute any commands in container via docker exec
 */

import { Tool, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';

export class ExecutorTool {
  // ❗ АРХИТЕКТУРА: Managers НЕ хранятся в конструкторе
  // Они создаются при каждом вызове с правильным profileName из args.profile
  constructor() {
    // No shared state - managers created per request
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
          profile: {
            type: 'string',
            description: 'Profile name from DOCKER_PROFILES environment variable (default: uses default profile)',
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
            description: 'Working directory (optional, auto-detected from docker-compose.yml working_dir if not specified)',
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
      profile?: string;
      project?: string;
      user?: string;
      workdir?: string;
      interactive?: boolean;
    };

    try {
      if (!args || !args.service || !args.command) {
        throw new Error('service and command parameters are required');
      }

      // Create container manager with profile
      const containerManager = new ContainerManager(args.profile);
      const projectDiscovery = new ProjectDiscovery();

      const project = await projectDiscovery.findProject(
        args.project ? { explicitProjectName: args.project } : {}
      );
      
      // Auto-detect working_dir from docker-compose.yml if not specified
      let workdir = args.workdir;
      if (!workdir && project.services[args.service]?.working_dir) {
        workdir = project.services[args.service].working_dir;
        logger.debug(`Using working_dir from docker-compose.yml: ${workdir}`);
      }
      
      // Parse command string to array
      const commandParts = this.parseCommand(args.command);
      
      logger.info(`Executing in ${args.service}: ${args.command}${workdir ? ` (workdir: ${workdir})` : ''}`);

      const output = await containerManager.exec(
        args.service,
        project.name,
        commandParts,
        {
          user: args.user,
          workdir: workdir,
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