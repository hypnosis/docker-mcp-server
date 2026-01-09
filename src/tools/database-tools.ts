/**
 * Database Tools
 * MCP Tools for working with databases
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { adapterRegistry } from '../adapters/adapter-registry.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';

export class DatabaseTools {
  private projectDiscovery: ProjectDiscovery;

  constructor() {
    this.projectDiscovery = new ProjectDiscovery();
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
              description: 'Profile name from profiles.json (default: local Docker)',
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
              description: 'Profile name from profiles.json (default: local Docker)',
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
              description: 'Profile name from profiles.json (default: local Docker)',
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

  private async handleQuery(args: any) {
    if (!args.service || !args.query) {
      throw new Error('service and query parameters are required');
    }

    const project = await this.projectDiscovery.findProject(
      args.project ? { explicitProjectName: args.project } : {}
    );
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    // Get adapter by database type
    const adapter = adapterRegistry.get(serviceConfig.type);

    const result = await adapter.query(args.service, args.query, {
      database: args.database,
      user: args.user,
      format: args.format,
    });

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

    const project = await this.projectDiscovery.findProject(
      args.project ? { explicitProjectName: args.project } : {}
    );
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    const adapter = adapterRegistry.get(serviceConfig.type);

    const backupPath = await adapter.backup(args.service, {
      output: args.output,
      format: args.format,
      compress: args.compress,
      tables: args.tables,
    });

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

    const project = await this.projectDiscovery.findProject(
      args.project ? { explicitProjectName: args.project } : {}
    );
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    const adapter = adapterRegistry.get(serviceConfig.type);

    await adapter.restore(args.service, args.backupPath, {
      database: args.database,
      clean: args.clean,
      dataOnly: args.dataOnly,
      schemaOnly: args.schemaOnly,
    });

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

    const project = await this.projectDiscovery.findProject(
      args.project ? { explicitProjectName: args.project } : {}
    );
    const serviceConfig = project.services[args.service];
    
    if (!serviceConfig) {
      throw new Error(`Service '${args.service}' not found in project`);
    }

    const adapter = adapterRegistry.get(serviceConfig.type);

    const status = await adapter.status(args.service);

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

