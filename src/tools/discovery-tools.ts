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
import { getDockerClient, getDockerClientForProfile } from '../utils/docker-client.js';

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
        name: 'docker_projects',
        description: 'List all Docker projects with their status. Fast mode using Docker labels only (~2s). Use docker_container_list({project: "name"}) for detailed container info.',
        inputSchema: {
          type: 'object',
          properties: {
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
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

  /**
   * Handle projects list
   * Works for both local and remote Docker using Docker Compose labels
   */
  private async handleProjects(args: any) {
    const { getDockerClientForProfile } = await import('../utils/docker-client.js');
    
    // Get Docker client (works for both local and remote)
    // getDockerClientForProfile() without args returns local client
    const dockerClient = getDockerClientForProfile(args?.profile);

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
