/**
 * Compose Manager
 * Управление docker-compose стеками
 */

import { ComposeExec } from '../utils/compose-exec.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { logger } from '../utils/logger.js';

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

  constructor() {
    this.projectDiscovery = new ProjectDiscovery();
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
    ComposeExec.run(project.composeFile, args, {
      cwd: project.projectDir,
    });
    logger.info('Services started successfully');
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
    });
    logger.info('Services stopped successfully');
  }
}
