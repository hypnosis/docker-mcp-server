/**
 * Container Manager
 * Управление Docker контейнерами
 */

import type Docker from 'dockerode';
import { logger } from '../utils/logger.js';
import { getDockerClient } from '../utils/docker-client.js';

export interface ContainerInfo {
  id: string;
  name: string;
  service: string;
  status: string;
  image: string;
  ports: string[];
  created: string;
}

export interface LogOptions {
  lines?: number;
  follow?: boolean;
  timestamps?: boolean;
  since?: string;
}

export class ContainerManager {
  private docker: Docker;

  constructor() {
    const client = getDockerClient();
    this.docker = client.getClient();
  }

  /**
   * Список контейнеров проекта
   */
  async listContainers(projectName: string): Promise<ContainerInfo[]> {
    logger.debug(`Listing containers for project: ${projectName}`);

    const containers = await this.docker.listContainers({
      all: true,
      filters: {
        name: [projectName],
      },
    });

    return containers.map((c) => this.mapContainerInfo(c, projectName));
  }

  /**
   * Запустить контейнер
   */
  async startContainer(serviceName: string, projectName: string): Promise<void> {
    const container = await this.findContainer(serviceName, projectName);
    
    logger.info(`Starting container: ${serviceName}`);
    await container.start();
    logger.info(`Container ${serviceName} started successfully`);
  }

  /**
   * Остановить контейнер
   */
  async stopContainer(serviceName: string, projectName: string, timeout = 10): Promise<void> {
    const container = await this.findContainer(serviceName, projectName);
    
    logger.info(`Stopping container: ${serviceName}`);
    await container.stop({ t: timeout });
    logger.info(`Container ${serviceName} stopped successfully`);
  }

  /**
   * Перезапустить контейнер
   */
  async restartContainer(serviceName: string, projectName: string, timeout = 10): Promise<void> {
    const container = await this.findContainer(serviceName, projectName);
    
    logger.info(`Restarting container: ${serviceName}`);
    await container.restart({ t: timeout });
    logger.info(`Container ${serviceName} restarted successfully`);
  }

  /**
   * Получить логи контейнера
   */
  async getLogs(serviceName: string, projectName: string, options: LogOptions = {}): Promise<string> {
    const container = await this.findContainer(serviceName, projectName);
    
    logger.debug(`Getting logs for: ${serviceName}`, options);

    // Для follow mode нужна отдельная обработка
    if (options.follow) {
      // В Sprint 1 поддерживаем только non-follow режим
      // Follow mode будет добавлен позже через streaming
      logger.warn('Follow mode not yet supported in Sprint 1');
    }

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.lines || 100,
      follow: false as const,
      timestamps: options.timestamps || false,
      since: options.since,
    });

    return logs.toString('utf-8');
  }

  /**
   * Выполнить команду в контейнере
   */
  async exec(
    serviceName: string,
    projectName: string,
    command: string[],
    options: { user?: string; workdir?: string; env?: string[] } = {}
  ): Promise<string> {
    const container = await this.findContainer(serviceName, projectName);
    
    logger.debug(`Executing in ${serviceName}:`, command.join(' '));

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      User: options.user,
      WorkingDir: options.workdir,
      Env: options.env,
    });

    const stream = await exec.start({});
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  }

  /**
   * Найти контейнер по имени сервиса
   */
  private async findContainer(serviceName: string, projectName: string): Promise<Docker.Container> {
    const containers = await this.listContainers(projectName);
    
    const found = containers.find((c) => c.service === serviceName);
    
    if (!found) {
      const available = containers.map((c) => c.service).join(', ');
      throw new Error(
        `Container '${serviceName}' not found in project '${projectName}'.\n` +
        `Available containers: ${available || 'none'}`
      );
    }

    return this.docker.getContainer(found.id);
  }

  /**
   * Маппинг Docker ContainerInfo → наш формат
   */
  private mapContainerInfo(container: any, projectName: string): ContainerInfo {
    // Имя контейнера: /project_service_1 → извлекаем service
    const fullName = container.Names[0]?.replace(/^\//, '') || '';
    const serviceName = this.extractServiceName(fullName, projectName);

    return {
      id: container.Id,
      name: fullName,
      service: serviceName,
      status: container.State,
      image: container.Image,
      ports: this.extractPorts(container.Ports),
      created: new Date(container.Created * 1000).toISOString(),
    };
  }

  /**
   * Извлекает порты из Docker container info
   */
  private extractPorts(ports: any[]): string[] {
    if (!ports || ports.length === 0) return [];

    return ports.map((p: any) => {
      if (p.PublicPort && p.PrivatePort) {
        return `${p.PublicPort}:${p.PrivatePort}`;
      }
      if (p.PrivatePort) {
        return `${p.PrivatePort}/${p.Type || 'tcp'}`;
      }
      return '';
    }).filter((p: string) => p.length > 0);
  }

  /**
   * Извлекает имя сервиса из имени контейнера
   * project_service_1 → service
   * project-service-1 → service
   */
  private extractServiceName(containerName: string, projectName: string): string {
    // Убираем project name из начала
    let name = containerName;
    
    if (name.startsWith(projectName)) {
      name = name.slice(projectName.length);
    }

    // Убираем разделители и номер в конце
    // project_service_1 → _service_1 → service_1 → service
    name = name.replace(/^[_-]/, '').replace(/[_-]\d+$/, '');

    return name || containerName; // Fallback на полное имя
  }
}