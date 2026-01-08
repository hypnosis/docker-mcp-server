/**
 * Discovery Tools
 * Tools for discovering Docker projects on remote servers
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import type { SSHConfig } from '../utils/ssh-config.js';
import { RemoteProjectDiscovery } from '../discovery/remote-discovery.js';
import { getDockerClient } from '../utils/docker-client.js';

export class DiscoveryTools {
  private sshConfig: SSHConfig | null;

  constructor(sshConfig?: SSHConfig | null) {
    this.sshConfig = sshConfig || null;
  }

  /**
   * Register discovery tools
   */
  getTools(): Tool[] {
    return [
      {
        name: 'docker_discover_projects',
        description: 'Discover all Docker projects on remote server. Uses Docker labels only (~2s). For detailed info about specific project, use docker_project_status',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Base path to search for projects (default: from profile or /var/www)',
            },
          },
        },
      },
      {
        name: 'docker_project_status',
        description: 'Get detailed status for a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project name',
            },
            path: {
              type: 'string',
              description: 'Base path to search for projects (default: from profile or /var/www)',
            },
          },
          required: ['project'],
        },
      },
    ];
  }

  /**
   * Handle tool call
   */
  async handleCall(request: CallToolRequest): Promise<any> {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'docker_discover_projects':
          return await this.handleDiscoverProjects(args);
        
        case 'docker_project_status':
          return await this.handleProjectStatus(args);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      logger.error(`Discovery tool ${name} failed:`, error);
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
   * Handle discover projects
   */
  private async handleDiscoverProjects(args: any) {
    // Check if remote mode
    if (!this.sshConfig) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: docker_discover_projects only works with remote Docker. Set up SSH configuration first.',
          },
        ],
        isError: true,
      };
    }

    // Get Docker client wrapper (handles SSH tunnel)
    const dockerClient = getDockerClient(this.sshConfig);

    // Create remote discovery instance with wrapper
    const discovery = new RemoteProjectDiscovery(this.sshConfig, dockerClient);

    // Discover projects
    const result = await discovery.discoverProjects({
      sshConfig: this.sshConfig,
      dockerClient: dockerClient.getClient(),
      basePath: args?.path,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Handle project status
   */
  private async handleProjectStatus(args: any) {
    if (!args?.project) {
      throw new Error('project parameter is required');
    }

    // Check if remote mode
    if (!this.sshConfig) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: docker_project_status only works with remote Docker. Set up SSH configuration first.',
          },
        ],
        isError: true,
      };
    }

    // Get Docker client wrapper (handles SSH tunnel)
    const dockerClient = getDockerClient(this.sshConfig);

    // Create remote discovery instance with wrapper
    const discovery = new RemoteProjectDiscovery(this.sshConfig, dockerClient);

    // Get project status
    const project = await discovery.getProjectStatus(args.project, {
      sshConfig: this.sshConfig,
      dockerClient: dockerClient.getClient(),
      basePath: args?.path,
    });

    if (!project) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Project "${args.project}" not found`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(project, null, 2),
        },
      ],
    };
  }
}
