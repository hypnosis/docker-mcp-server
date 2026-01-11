/**
 * Compose Manager
 * Управление docker-compose стеками
 */

import { ComposeExec } from '../utils/compose-exec.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';
import { extractPortFromError, findContainerByPort, stopContainerById } from '../utils/port-utils.js';
import { loadProfileConfig } from '../utils/docker-client.js';
import type { SSHConfig } from '../utils/ssh-config.js';

export interface ComposeUpOptions {
  build?: boolean;
  detach?: boolean;
  services?: string[];
  scale?: Record<string, number>;
}

export interface ComposeDownOptions {
  volumes?: boolean;
  removeOrphans?: boolean;
  timeout?: number;
}

export class ComposeManager {
  private projectDiscovery: ProjectDiscovery;
  private sshConfig: SSHConfig | null;

  constructor(profileName?: string) {
    this.projectDiscovery = new ProjectDiscovery();
    // Load SSH config from profile (if specified)
    this.sshConfig = profileName ? loadProfileConfig(profileName) : null;
    
    if (this.sshConfig) {
      logger.debug(`ComposeManager initialized with profile "${profileName}": ${this.sshConfig.host}`);
    }
  }

  /**
   * docker-compose up
   * Запускает все сервисы из docker-compose.yml
   */
  async composeUp(options: ComposeUpOptions = {}): Promise<void> {
    const project = await this.projectDiscovery.findProject();

    const args: string[] = ['up'];

    // Detach по умолчанию (true)
    if (options.detach !== false) {
      args.push('-d');
    }

    // Build images before starting
    if (options.build) {
      args.push('--build');
    }

    // Scale services
    if (options.scale) {
      for (const [service, count] of Object.entries(options.scale)) {
        args.push('--scale', `${service}=${count}`);
      }
    }

    // Specific services
    if (options.services && options.services.length > 0) {
      args.push(...options.services);
    }

    logger.info('Starting services with docker-compose up');
    
    try {
      ComposeExec.run(project.composeFile, args, {
        cwd: project.projectDir,
        sshConfig: this.sshConfig,
      });
      logger.info('Services started successfully');
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      
      logger.debug('Error message for port detection:', errorMessage);
      
      // Проверяем, является ли это ошибкой занятого порта
      const port = extractPortFromError(errorMessage);
      
      logger.debug(`Extracted port from error: ${port}`);
      
      if (port) {
        logger.warn(`Port ${port} is already in use. Attempting to find and handle conflict...`);
        
        const conflict = await findContainerByPort(port);
        
        if (conflict) {
          const suggestion = `Port ${port} is already allocated by container "${conflict.containerName}" (${conflict.containerId.substring(0, 12)}). ` +
            `Status: ${conflict.status}. ` +
            `You can stop it with: docker_container_stop({service: "${conflict.containerName}"}) or manually stop the container.`;
          
          throw new Error(
            `Port conflict detected: ${suggestion}\n\n` +
            `Original error: ${errorMessage}`
          );
        } else {
          // Порт занят, но контейнер не найден (возможно, не через Docker)
          throw new Error(
            `Port ${port} is already in use, but conflicting container not found via Docker API. ` +
            `Please check if another process is using port ${port}.\n\n` +
            `Original error: ${errorMessage}`
          );
        }
      }
      
      // Если это не ошибка порта, пробрасываем оригинальную ошибку
      throw error;
    }
  }

  /**
   * docker-compose down
   * Останавливает и удаляет все контейнеры
   */
  async composeDown(options: ComposeDownOptions = {}): Promise<void> {
    const project = await this.projectDiscovery.findProject();

    const args: string[] = ['down'];

    // Remove volumes
    if (options.volumes) {
      args.push('-v');
    }

    // Remove orphaned containers
    if (options.removeOrphans) {
      args.push('--remove-orphans');
    }

    // Shutdown timeout
    if (options.timeout) {
      args.push('-t', options.timeout.toString());
    }

    logger.info('Stopping services with docker-compose down');
    ComposeExec.run(project.composeFile, args, {
      cwd: project.projectDir,
      sshConfig: this.sshConfig,
    });
    logger.info('Services stopped successfully');
  }
}
