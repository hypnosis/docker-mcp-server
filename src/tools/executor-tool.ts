/**
 * Universal Executor Tool
 * Execute any commands in container via docker exec
 */

import { Tool, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';
import type { SSHConfig } from '../utils/ssh-config.js';

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
          profile: {
            type: 'string',
            description: 'Profile name from profiles.json (default: local Docker)',
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

      // Get SSH config for profile
      const sshConfig = this.getSSHConfigForProfile(args.profile);
      const containerManager = new ContainerManager(sshConfig);

      const project = await this.projectDiscovery.findProject(
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

  /**
   * Helper: get SSH config for profile
   * Returns null for local profile or undefined profile
   */
  private getSSHConfigForProfile(profile?: string): SSHConfig | null {
    if (!profile) {
      return null; // Local Docker
    }

    // Load profile configuration
    const profilesFile = process.env.DOCKER_MCP_PROFILES_FILE;
    if (!profilesFile) {
      logger.warn('DOCKER_MCP_PROFILES_FILE not set, using local Docker');
      return null;
    }

    try {
      const { loadProfilesFile, profileDataToSSHConfig } = require('../utils/profiles-file.js');
      const fileResult = loadProfilesFile(profilesFile);
      
      if (fileResult.errors.length > 0 || !fileResult.config) {
        logger.warn(`Failed to load profiles file: ${fileResult.errors.join(', ')}`);
        return null;
      }
      
      const profileData = fileResult.config.profiles[profile];
      if (!profileData) {
        logger.warn(`Profile "${profile}" not found, using local Docker`);
        return null;
      }
      
      // Check if local mode
      if (profileData.mode === 'local') {
        return null;
      }
      
      // Convert to SSHConfig
      return profileDataToSSHConfig(profileData);
    } catch (error: any) {
      logger.warn(`Failed to load profile "${profile}": ${error.message}`);
      return null;
    }
  }
}