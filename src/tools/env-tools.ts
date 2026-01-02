/**
 * Environment Tools
 * MCP Tools for working with environment variables and configuration
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { EnvManager } from '../managers/env-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ComposeParser } from '../discovery/compose-parser.js';
import { ComposeExec } from '../utils/compose-exec.js';
import { stringify as stringifyYaml } from 'yaml';
import { logger } from '../utils/logger.js';

export class EnvTools {
  private envManager: EnvManager;
  private projectDiscovery: ProjectDiscovery;
  private containerManager: ContainerManager;
  private composeParser: ComposeParser;

  constructor() {
    this.envManager = new EnvManager();
    this.projectDiscovery = new ProjectDiscovery();
    this.containerManager = new ContainerManager();
    this.composeParser = new ComposeParser();
  }

  /**
   * Register all environment tools
   */
  getTools(): Tool[] {
    return [
      {
        name: 'docker_env_list',
        description: 'List environment variables from .env files and docker-compose.yml',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            maskSecrets: {
              type: 'boolean',
              description: 'Mask sensitive values (passwords, tokens, etc.). Default: true',
              default: true,
            },
            service: {
              type: 'string',
              description: 'Show env for specific service only',
            },
          },
        },
      },
      {
        name: 'docker_compose_config',
        description: 'Show parsed docker-compose configuration',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            services: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Show config for specific services only',
            },
            resolve: {
              type: 'boolean',
              description: 'Resolve variables using docker-compose config CLI. Default: false',
              default: false,
            },
          },
        },
      },
      {
        name: 'docker_healthcheck',
        description: 'Check health status of all services',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project name (auto-detected if not provided)',
            },
            services: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Check specific services only',
            },
          },
        },
      },
    ];
  }

  /**
   * Handle tool calls
   */
  async handleCall(request: CallToolRequest) {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'docker_env_list':
          return await this.handleEnvList(args);
        
        case 'docker_compose_config':
          return await this.handleComposeConfig(args);
        
        case 'docker_healthcheck':
          return await this.handleHealthcheck(args);
        
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
   * Get project (helper)
   */
  private async getProject(projectName?: string) {
    return await this.projectDiscovery.findProject(
      projectName ? { explicitPath: projectName } : {}
    );
  }

  /**
   * docker_env_list handler
   */
  private async handleEnvList(args: any) {
    const project = await this.getProject(args?.project);
    
    // If service is specified, load env for specific service
    let env: Record<string, string>;
    if (args?.service) {
      const serviceConfig = project.services[args.service];
      if (!serviceConfig) {
        throw new Error(
          `Service '${args.service}' not found in project '${project.name}'. ` +
          `Available services: ${Object.keys(project.services).join(', ')}`
        );
      }
      env = this.envManager.loadEnv(project.projectDir, args.service, serviceConfig);
    } else {
      // Load global env (without service)
      env = this.envManager.loadEnv(project.projectDir);
    }

    // Mask secrets (default: true)
    const shouldMask = args?.maskSecrets !== false;
    const result = shouldMask ? this.envManager.maskSecrets(env) : env;

    // Count number of masked secrets
    let maskedCount = 0;
    if (shouldMask) {
      for (const [key, value] of Object.entries(result)) {
        if (value === '***MASKED***') {
          maskedCount++;
        }
      }
    }

    // Format result
    const output = Object.entries(result)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const summary = shouldMask && maskedCount > 0
      ? `\n\n🔒 ${maskedCount} secret(s) masked`
      : '';

    return {
      content: [
        {
          type: 'text',
          text: `Environment Variables:\n${output}${summary}`,
        },
      ],
    };
  }

  /**
   * docker_compose_config handler
   */
  private async handleComposeConfig(args: any) {
    const project = await this.getProject(args?.project);
    const shouldResolve = args?.resolve === true;
    
    let output: string;

    if (shouldResolve) {
      // Использовать CLI для полного resolve
      logger.debug('Using docker-compose config CLI for resolved config');
      
      // Примечание: docker-compose config не поддерживает фильтрацию по services
      // Показываем весь config
      if (args?.services && Array.isArray(args.services)) {
        logger.warn('Filtering by services is not supported with resolve=true. Showing full config.');
      }
      
      try {
        output = ComposeExec.run(project.composeFile, ['config'], {
          cwd: project.projectDir,
        });
      } catch (error: any) {
        throw new Error(`Failed to get resolved config: ${error.message}`);
      }
    } else {
      // Использовать parsed config (быстро, без resolve)
      logger.debug('Using parsed config (no resolve)');
      
      const rawConfig = this.composeParser.parseRaw(project.composeFile);
      
      // Фильтровать по services если указано
      if (args?.services && Array.isArray(args.services)) {
        const filteredConfig: any = {
          ...rawConfig,
          services: {},
        };
        
        for (const serviceName of args.services) {
          if (rawConfig.services && rawConfig.services[serviceName]) {
            filteredConfig.services[serviceName] = rawConfig.services[serviceName];
          } else {
            throw new Error(
              `Service '${serviceName}' not found in project '${project.name}'. ` +
              `Available services: ${Object.keys(rawConfig.services || {}).join(', ')}`
            );
          }
        }
        
        output = stringifyYaml(filteredConfig);
      } else {
        // Показать весь config
        output = stringifyYaml(rawConfig);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  /**
   * docker_healthcheck handler
   */
  private async handleHealthcheck(args: any) {
    const project = await this.getProject(args?.project);
    
    // Получить список всех контейнеров
    const containers = await this.containerManager.listContainers(project.name);
    
    // Фильтровать по services если указано
    let servicesToCheck: string[];
    if (args?.services && Array.isArray(args.services)) {
      servicesToCheck = args.services;
      
      // Проверить что все указанные сервисы существуют
      const availableServices = containers.map(c => c.service);
      for (const serviceName of servicesToCheck) {
        if (!availableServices.includes(serviceName)) {
          throw new Error(
            `Service '${serviceName}' not found in project '${project.name}'. ` +
            `Available services: ${availableServices.join(', ')}`
          );
        }
      }
    } else {
      // Проверяем все сервисы
      servicesToCheck = containers.map(c => c.service);
    }
    
    // Получить health status для каждого сервиса
    const serviceStatuses = await Promise.all(
      servicesToCheck.map(async (serviceName) => {
        try {
          const health = await this.containerManager.getHealthStatus(serviceName, project.name, project.composeFile, project.projectDir);
          return {
            name: serviceName,
            status: health.status,
            checks: health.checks,
            failures: health.failures,
          };
        } catch (error: any) {
          logger.error(`Failed to get health for ${serviceName}:`, error);
          return {
            name: serviceName,
            status: 'none' as const,
            checks: 0,
            failures: 0,
          };
        }
      })
    );
    
    // Вычислить overall status
    const overallStatus = this.calculateOverallStatus(serviceStatuses);
    
    // Форматировать результат
    const result = {
      overall: overallStatus,
      services: serviceStatuses,
    };
    
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
   * Вычислить общий статус здоровья
   */
  private calculateOverallStatus(serviceStatuses: Array<{ status: string; failures: number }>): 'healthy' | 'degraded' | 'unhealthy' {
    const hasUnhealthy = serviceStatuses.some(s => s.status === 'unhealthy');
    if (hasUnhealthy) {
      return 'unhealthy';
    }
    
    const hasFailures = serviceStatuses.some(s => s.failures > 0);
    const hasStarting = serviceStatuses.some(s => s.status === 'starting');
    const hasNotRunning = serviceStatuses.some(s => s.status === 'not_running');
    
    if (hasFailures || hasStarting || hasNotRunning) {
      return 'degraded';
    }
    
    // Все healthy или none (none считается OK если контейнер running)
    return 'healthy';
  }
}

