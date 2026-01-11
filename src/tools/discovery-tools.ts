/**
 * Discovery Tools
 * Tools for discovering Docker projects on remote servers
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { RemoteProjectDiscovery } from '../discovery/remote-discovery.js';
import { getDockerClientForProfile } from '../utils/docker-client.js';

export class DiscoveryTools {
  // ❗ АРХИТЕКТУРА: profile резолвится из args.profile при каждом вызове
  constructor() {
    // No shared state - profile resolved per request
  }

  /**
   * Register discovery tools
   */
  getTools(): Tool[] {
    return [
      {
        name: 'docker_projects',
        description: 'List all Docker projects with their status. Fast mode using Docker labels only (~2s). Use docker_container_list({project: "name"}) for detailed container info.',
        inputSchema: {
          type: 'object',
          properties: {
            profile: {
              type: 'string',
              description: 'Profile name from DOCKER_PROFILES environment variable (default: uses default profile)',
            },
            path: {
              type: 'string',
              description: 'Base path to search for projects (default: from profile or /var/www)',
            },
          },
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
        case 'docker_projects':
          return await this.handleProjects(args);
        
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
   * Handle projects list
   * Works for both local and remote Docker using Docker Compose labels
   */
  private async handleProjects(args: any) {
    // Get Docker client (works for both local and remote)
    const dockerClient = getDockerClientForProfile(args.profile);
    const docker = dockerClient.getClient();

    // Get all containers with compose labels
    const allContainers = await docker.listContainers({ all: true });
    
    const containersWithLabels = allContainers.filter(container => {
      const labels = container.Labels || {};
      return Object.keys(labels).some(key => key.startsWith('com.docker.compose.'));
    });

    if (containersWithLabels.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No Docker projects found with Compose labels.',
          },
        ],
      };
    }

    // Group containers by project name from labels
    const projectsMap = new Map<string, { running: number; total: number }>();
    
    containersWithLabels.forEach(container => {
      const labels = container.Labels || {};
      const projectName = labels['com.docker.compose.project'] || 'default';
      
      if (!projectsMap.has(projectName)) {
        projectsMap.set(projectName, { running: 0, total: 0 });
      }
      
      const project = projectsMap.get(projectName)!;
      project.total++;
      if (container.State === 'running') {
        project.running++;
      }
    });

    // Calculate summary
    const projects = Array.from(projectsMap.entries()).map(([name, data]) => ({
      name,
      running: data.running,
      total: data.total,
      status: data.running === data.total ? 'running' : data.running === 0 ? 'stopped' : 'partial',
    }));

    const summary = {
      total: projects.length,
      running: projects.filter(p => p.status === 'running').length,
      partial: projects.filter(p => p.status === 'partial').length,
      stopped: projects.filter(p => p.status === 'stopped').length,
    };

    // Format result
    const output = [
      `Found ${summary.total} projects:\n`,
      `- Running: ${summary.running}`,
      `- Partial: ${summary.partial}`,
      `- Stopped: ${summary.stopped}\n`,
      ...projects.map(p => {
        const statusIcon = p.status === 'running' ? '✅' : p.status === 'partial' ? '⚠️' : '❌';
        return `${statusIcon} ${p.name} (${p.running}/${p.total} running)`;
      }),
    ].join('\n');

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }
}
