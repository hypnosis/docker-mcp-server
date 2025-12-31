/**
 * Docker Client Wrapper
 * Обёртка над Dockerode для централизованного управления
 */

import Docker from 'dockerode';
import { logger } from './logger.js';

/**
 * Wrapper над Dockerode для централизованного управления
 */
export class DockerClient {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
    logger.debug('Dockerode client initialized');
  }

  /**
   * Проверка подключения к Docker
   */
  async ping(): Promise<void> {
    try {
      await this.docker.ping();
      logger.info('Docker connection verified');
    } catch (error: any) {
      logger.error('Docker connection failed:', error);
      throw new Error(
        'Docker is not running. Please start Docker Desktop and try again.'
      );
    }
  }

  /**
   * Получить native Dockerode instance
   */
  getClient(): Docker {
    return this.docker;
  }

  /**
   * Список контейнеров
   */
  async listContainers(options?: Docker.ContainerListOptions) {
    return this.docker.listContainers(options);
  }

  /**
   * Получить контейнер по ID или имени
   */
  getContainer(id: string): Docker.Container {
    return this.docker.getContainer(id);
  }
}

// Singleton instance
let dockerClientInstance: DockerClient | null = null;

/**
 * Получить singleton instance DockerClient
 */
export function getDockerClient(): DockerClient {
  if (!dockerClientInstance) {
    dockerClientInstance = new DockerClient();
  }
  return dockerClientInstance;
}