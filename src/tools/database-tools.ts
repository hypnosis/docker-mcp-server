/**
 * Database Tools
 * MCP Tools for working with databases
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { PostgreSQLAdapter } from '../adapters/postgresql.js';
import { RedisAdapter } from '../adapters/redis.js';
import { SQLiteAdapter } from '../adapters/sqlite.js';
import type { DatabaseAdapter } from '../adapters/database-adapter.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { EnvManager } from '../managers/env-manager.js';
import { logger } from '../utils/logger.js';
import type { SSHConfig } from '../utils/ssh-config.js';
import { resolveSSHConfig } from '../utils/profile-resolver.js';
import { readRemoteComposeFile } from '../utils/remote-compose.js';

export class DatabaseTools {
  constructor() {
    // No shared state - adapters created per request
  }

  /**
   * Register all database tools
   */
  getTools(): Tool[] {
    return [
      {
        name: 'docker_db_query',
        description: 'Execute a SQL query or database command',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Database service name from docker-compose.yml',
            },
            profile: {
              type: 'string',
              description: 'Profile name from DOCKER_PROFILES environment variable (default: uses default profile)',
            },
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            query: {
              type: 'string',
              description: 'SQL query or database command',
            },
            database: {
              type: 'string',
              description: 'Database name (overrides auto-detection)',
            },
            user: {
              type: 'string',
              description: 'Database user (overrides auto-detection)',
            },
            format: {
              type: 'string',
              enum: ['table', 'json', 'csv'],
              description: 'Output format',
              default: 'table',
            },
          },
          required: ['service', 'query'],
        },
      },
      {
        name: 'docker_db_backup',
        description: 'Create a database backup',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Database service name',
            },
            profile: {
              type: 'string',
              description: 'Profile name from DOCKER_PROFILES environment variable (default: uses default profile)',
            },
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            output: {
              type: 'string',
              description: 'Output file path (auto-generated if not provided)',
            },
            format: {
              type: 'string',
              enum: ['sql', 'custom', 'tar', 'directory'],
              description: 'Backup format',
            },
            compress: {
              type: 'boolean',
              description: 'Compress backup',
              default: true,
            },
            tables: {
              type: 'array',
              items: { type: 'string' },
              description: 'Backup only specific tables',
            },
          },
          required: ['service'],
        },
      },
      {
        name: 'docker_db_restore',
        description: 'Restore database from backup',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Database service name',
            },
            profile: {
              type: 'string',
              description: 'Profile name from DOCKER_PROFILES environment variable (default: uses default profile)',
            },
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            backupPath: {
              type: 'string',
              description: 'Path to backup file',
            },
            database: {
              type: 'string',
              description: 'Target database name',
            },
            clean: {
              type: 'boolean',
              description: 'Drop database before restore',
              default: false,
            },
            dataOnly: {
              type: 'boolean',
              description: 'Restore only data',
              default: false,
            },
            schemaOnly: {
              type: 'boolean',
              description: 'Restore only schema',
              default: false,
            },
          },
          required: ['service', 'backupPath'],
        },
      },
      {
        name: 'docker_db_status',
        description: 'Get database status and statistics',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Database service name',
            },
            profile: {
              type: 'string',
              description: 'Profile name from DOCKER_PROFILES environment variable (default: uses default profile)',
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
        case 'docker_db_query':
          return await this.handleQuery(args);
        
        case 'docker_db_backup':
          return await this.handleBackup(args);
        
        case 'docker_db_restore':
          return await this.handleRestore(args);
        
        case 'docker_db_status':
          return await this.handleStatus(args);
        
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

  /**
   * Validate profile configuration
   * Throws explicit error if profile specified but not found
   */
  private validateProfile(profile?: string, sshConfig?: SSHConfig | null): void {
    // ❗ CRITICAL: If profile specified, SSH config MUST be present
    if (profile && !sshConfig) {
      throw new Error(
        `❌ PROFILE ERROR: Profile "${profile}" was specified but could not be resolved.\n` +
        `\n` +
        `Possible causes:\n` +
        `  1. Profile "${profile}" not found in DOCKER_PROFILES environment variable\n` +
        `  2. DOCKER_PROFILES environment variable not set\n` +
        `  3. DOCKER_PROFILES JSON is invalid or missing\n` +
        `\n` +
        `⚠️  NO FALLBACK TO LOCAL: This is intentional to prevent accidental local operations.\n` +
        `    If you want to use local Docker, omit the "profile" parameter.`
      );
    }
    
    // Log successful profile resolution
    if (profile && sshConfig) {
      logger.info(`✅ Profile "${profile}" resolved successfully: ${sshConfig.host}:${sshConfig.port || 22}`);
    } else if (!profile) {
      logger.debug('Using local Docker (no profile specified)');
    }
  }

  /**
   * Create database adapter with dependency injection
   * All dependencies are explicitly created and passed
   */
  private createAdapter(
    serviceType: string,
    sshConfig: SSHConfig | null
  ): DatabaseAdapter {
    // Create managers with explicit SSH config
    const containerManager = new ContainerManager(sshConfig);
    const projectDiscovery = new ProjectDiscovery();
    const envManager = new EnvManager();
    
    // Create adapter with dependency injection
    const normalizedType = serviceType.toLowerCase();
    
    switch (normalizedType) {
      case 'postgresql':
      case 'postgres':
        logger.debug(`Creating PostgreSQLAdapter with ${sshConfig ? 'remote' : 'local'} Docker`);
        return new PostgreSQLAdapter(containerManager, projectDiscovery, envManager);
        
      case 'redis':
        logger.debug(`Creating RedisAdapter with ${sshConfig ? 'remote' : 'local'} Docker`);
        return new RedisAdapter(containerManager, projectDiscovery, envManager);
        
      case 'sqlite':
      case 'sqlite3':
        logger.debug(`Creating SQLiteAdapter with ${sshConfig ? 'remote' : 'local'} Docker`);
        return new SQLiteAdapter(containerManager, projectDiscovery, envManager);
        
      default:
        throw new Error(
          `❌ DATABASE ERROR: Unsupported database type: ${serviceType}\n` +
          `\n` +
          `Supported types:\n` +
          `  - postgresql (postgres)\n` +
          `  - redis\n` +
          `  - sqlite (sqlite3)`
        );
    }
  }

  /**
   * Get project helper (unified pattern with other tools)
   * Reads remote/local compose file based on SSH config
   */
  private async getProject(projectName?: string, sshConfig?: SSHConfig | null) {
    // If SSH config provided (remote mode), read remote compose file
    if (sshConfig) {
      let finalProjectName: string;
      if (projectName) {
        finalProjectName = projectName;
      } else {
        // Use working directory name as fallback
        const cwd = process.cwd();
        finalProjectName = cwd.split('/').pop() || 'docker-mcp-server';
      }
      
      // ✅ FIX BUG-007: Read and parse remote docker-compose.yml
      logger.info(`Reading remote compose file for project: ${finalProjectName}`);
      return await readRemoteComposeFile(finalProjectName, sshConfig);
    }
    
    // Local mode: use local discovery
    const projectDiscovery = new ProjectDiscovery();
    return await projectDiscovery.findProject(
      projectName ? { explicitProjectName: projectName } : {}
    );
  }

  private async handleQuery(args: any) {
    if (!args.service || !args.query) {
      throw new Error('service and query parameters are required');
    }

    // Resolve profile once (unified pattern)
    const sshConfig = resolveSSHConfig(args);
    this.validateProfile(args?.profile, sshConfig);
    
    const project = await this.getProject(args?.project, sshConfig);
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    const adapter = this.createAdapter(serviceConfig.type, sshConfig);

    // ✅ FIX BUG-007: Pass project to adapter for remote mode
    const result = await adapter.query(args.service, args.query, {
      database: args.database,
      user: args.user,
      format: args.format,
    }, project);

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  private async handleBackup(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const sshConfig = resolveSSHConfig(args);
    this.validateProfile(args?.profile, sshConfig);
    
    const project = await this.getProject(args?.project, sshConfig);
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    const adapter = this.createAdapter(serviceConfig.type, sshConfig);

    // ✅ FIX BUG-007: Pass project to adapter for remote mode
    const backupPath = await adapter.backup(args.service, {
      output: args.output,
      format: args.format,
      compress: args.compress,
      tables: args.tables,
    }, project);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Backup created successfully\nLocation: ${backupPath}`,
        },
      ],
    };
  }

  private async handleRestore(args: any) {
    if (!args.service || !args.backupPath) {
      throw new Error('service and backupPath parameters are required');
    }

    const sshConfig = resolveSSHConfig(args);
    this.validateProfile(args?.profile, sshConfig);
    
    const project = await this.getProject(args?.project, sshConfig);
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    const adapter = this.createAdapter(serviceConfig.type, sshConfig);

    // ✅ FIX BUG-007: Pass project to adapter for remote mode
    await adapter.restore(args.service, args.backupPath, {
      database: args.database,
      clean: args.clean,
      dataOnly: args.dataOnly,
      schemaOnly: args.schemaOnly,
    }, project);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Restore completed successfully`,
        },
      ],
    };
  }

  private async handleStatus(args: any) {
    if (!args.service) {
      throw new Error('service parameter is required');
    }

    const sshConfig = resolveSSHConfig(args);
    this.validateProfile(args?.profile, sshConfig);
    
    const project = await this.getProject(args?.project, sshConfig);
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    if (serviceConfig.type === 'generic') {
      throw new Error(
        `❌ Service type detection failed!\n` +
        `Service "${args.service}" was detected as "generic" instead of a database type.\n` +
        `Image: ${serviceConfig.image || 'unknown'}\n` +
        `Please check the image name in docker-compose.yml.`
      );
    }

    const adapter = this.createAdapter(serviceConfig.type, sshConfig);

    // ✅ FIX BUG-007: Pass project to adapter for remote mode
    const status = await adapter.status(args.service, project);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }
}

