/**
 * Container Tools
 * MCP Tools for Docker container management
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ComposeManager } from '../managers/compose-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';
import { getDockerClientForProfile } from '../utils/docker-client.js';
import type { SSHConfig } from '../utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from '../utils/profiles-file.js';

export class ContainerTools {
  private containerManager: ContainerManager;
  private composeManager: ComposeManager;
  private projectDiscovery: ProjectDiscovery;

  constructor(sshConfig?: SSHConfig | null) {
    this.containerManager = new ContainerManager(sshConfig);
    this.composeManager = new ComposeManager(sshConfig);
    this.projectDiscovery = new ProjectDiscovery();
  }

  /**
   * Register all container tools
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
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
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
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
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
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
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
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
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
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
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
            follow: {
              type: 'boolean',
              description: 'Follow log output (stream)',
              default: false,
            },
          },
          required: ['service'],
        },
      },
      {
        name: 'docker_compose_up',
        description: 'Start all services defined in docker-compose.yml',
        inputSchema: {
          type: 'object',
          properties: {
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
            },
            build: {
              type: 'boolean',
              description: 'Build images before starting',
              default: false,
            },
            detach: {
              type: 'boolean',
              description: 'Run in background',
              default: true,
            },
            services: {
              type: 'array',
              items: { type: 'string' },
              description: 'Start only specific services',
            },
            scale: {
              type: 'object',
              description: 'Scale services (e.g., {"web": 3})',
            },
          },
        },
      },
      {
        name: 'docker_compose_down',
        description: 'Stop and remove all containers',
        inputSchema: {
          type: 'object',
          properties: {
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
            },
            volumes: {
              type: 'boolean',
              description: 'Remove volumes',
              default: false,
            },
            removeOrphans: {
              type: 'boolean',
              description: 'Remove orphaned containers',
              default: false,
            },
            timeout: {
              type: 'number',
              description: 'Shutdown timeout in seconds',
              default: 10,
            },
          },
        },
      },
      {
        name: 'docker_resource_list',
        description: 'List Docker resources (images, volumes, or networks)',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['images', 'volumes', 'networks'],
              description: 'Type of resource to list',
            },
            profile: {
              type: 'string',
              description: 'Profile name from profiles.json (default: local Docker)',
            },
          },
          required: ['type'],
        },
      },
      {
        name: 'docker_container_stats',
        description: 'Get container resource usage statistics (CPU, Memory, Network, Block I/O)',
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
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
          },
          required: ['service'],
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
        
        case 'docker_compose_up':
          return await this.handleComposeUp(args);
        
        case 'docker_compose_down':
          return await this.handleComposeDown(args);
        
        case 'docker_resource_list':
          return await this.handleResourceList(args);
        
        case 'docker_container_stats':
          return await this.handleStats(args);
        
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
    const profile = args?.profile;
    const sshConfig = this.getSSHConfigForProfile(profile);
    const containerManager = new ContainerManager(sshConfig);
    
    // REST API approach:
    // - No project parameter: show ALL containers with compose labels
    // - With project: show only that project's containers
    const projectName = args?.project || '';
    
    const containers = await containerManager.listContainers(projectName);

    if (containers.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No containers found with Docker Compose labels.',
          },
        ],
      };
    }

    // Group by project if no project specified
    if (!args?.project) {
      const grouped = new Map<string, typeof containers>();
      containers.forEach(c => {
        const projectName = c.project || 'unknown';
        if (!grouped.has(projectName)) {
          grouped.set(projectName, []);
        }
        grouped.get(projectName)!.push(c);
      });

      const output = Array.from(grouped.entries()).map(([proj, conts]) => {
        const containersList = conts.map(c => `  - ${c.name} (${c.status})`).join('\n');
        return `📦 ${proj} (${conts.length} containers)\n${containersList}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    }

    // Single project: simple list
    const containerList = containers.map(c => {
      return `${c.name} (${c.status}) - ${c.image}`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: containerList,
        },
      ],
    };
  }

  private async handleStart(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const containerManager = new ContainerManager(sshConfig);
    const project = await this.getProject(args?.project);
    await containerManager.startContainer(args.service, project.name, project.composeFile, project.projectDir);

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

    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const containerManager = new ContainerManager(sshConfig);
    const project = await this.getProject(args?.project);
    await containerManager.stopContainer(
      args.service,
      project.name,
      args?.timeout || 10,
      project.composeFile,
      project.projectDir
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

    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const containerManager = new ContainerManager(sshConfig);
    const project = await this.getProject(args?.project);
    await containerManager.restartContainer(
      args.service,
      project.name,
      args?.timeout || 10,
      project.composeFile,
      project.projectDir
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

    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const containerManager = new ContainerManager(sshConfig);
    const project = await this.getProject(args?.project);
    const logs = await containerManager.getLogs(
      args.service,
      project.name,
      {
        lines: args?.lines || 100,
        timestamps: args?.timestamps || false,
        follow: args?.follow || false,
      },
      project.composeFile,
      project.projectDir
    );

    // If this is a stream (follow mode), collect data from stream
    if (args?.follow && typeof logs !== 'string') {
      const stream = logs as NodeJS.ReadableStream;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          const output = Buffer.concat(chunks).toString('utf-8');
          resolve({
            content: [
              {
                type: 'text',
                text: output,
              },
            ],
          });
        });

        stream.on('error', (error) => {
          reject(error);
        });
      });
    }

    // Normal mode (string)
    return {
      content: [
        {
          type: 'text',
          text: logs as string,
        },
      ],
    };
  }

  private async handleComposeUp(args: any) {
    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const composeManager = new ComposeManager(sshConfig);
    await composeManager.composeUp({
      build: args?.build || false,
      detach: args?.detach !== false, // default: true
      services: args?.services,
      scale: args?.scale,
    });

    return {
      content: [
        {
          type: 'text',
          text: '✅ All services started successfully',
        },
      ],
    };
  }

  private async handleComposeDown(args: any) {
    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const composeManager = new ComposeManager(sshConfig);
    await composeManager.composeDown({
      volumes: args?.volumes || false,
      removeOrphans: args?.removeOrphans || false,
      timeout: args?.timeout || 10,
    });

    return {
      content: [
        {
          type: 'text',
          text: '✅ All services stopped successfully',
        },
      ],
    };
  }

  private async handleResourceList(args: any) {
    if (!args.type) {
      throw new Error('type parameter is required (images, volumes, or networks)');
    }

    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const containerManager = new ContainerManager(sshConfig);

    let resources;
    switch (args.type) {
      case 'images':
        resources = await containerManager.listImages();
        break;
      case 'volumes':
        resources = await containerManager.listVolumes();
        break;
      case 'networks':
        resources = await containerManager.listNetworks();
        break;
      default:
        throw new Error(`Invalid resource type: ${args.type}. Must be one of: images, volumes, networks`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(resources, null, 2),
        },
      ],
    };
  }

  private async handleStats(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const sshConfig = this.getSSHConfigForProfile(args?.profile);
    const containerManager = new ContainerManager(sshConfig);
    const project = await this.getProject(args?.project);
    const stats = await containerManager.getContainerStats(args.service, project.name, project.composeFile, project.projectDir);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * Helper: get project config (auto-detect or explicit)
   */
  private async getProject(explicitName?: string) {
    // If explicit name provided, use it (for remote Docker)
    if (explicitName) {
      return this.projectDiscovery.findProject({
        explicitProjectName: explicitName,
      });
    }
    
    // Otherwise, use auto-detect (local Docker)
    return this.projectDiscovery.findProject();
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