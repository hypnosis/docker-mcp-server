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

export interface ContainerHealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'not_running';
  checks: number;
  failures: number;
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
  async listContainers(projectName: string, composeFile?: string, projectDir?: string): Promise<ContainerInfo[]> {
    logger.debug(`Listing containers for project: ${projectName}`);

    // Вариант 1: Используем Docker Compose labels (прямой вызов Docker API)
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: [`com.docker.compose.project=${projectName}`],
        },
      });

      if (containers.length > 0) {
        logger.debug(`Found ${containers.length} containers via Docker Compose labels`);
        return containers.map((c) => this.mapContainerInfo(c, projectName));
      }
      
      logger.debug('No containers found via labels, trying fallback methods');
    } catch (error) {
      logger.debug('Failed to list containers via labels:', error);
    }

    // Fallback 1: Используем docker-compose ps CLI (если есть composeFile)
    if (composeFile && projectDir) {
      try {
        const { ComposeExec } = await import('../utils/compose-exec.js');
        const output = ComposeExec.run(composeFile, ['ps', '--format', 'json'], {
          cwd: projectDir,
        });
        
        const composeContainers = output
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(c => c && c.Name);

        if (composeContainers.length > 0) {
          logger.debug(`Found ${composeContainers.length} containers via docker-compose ps`);
          
          // Получаем полную информацию о контейнерах через Docker API
          const containerNames = composeContainers.map(c => c.Name);
          const allContainers = await this.docker.listContainers({ all: true });
          
          const projectContainers = allContainers.filter(c => {
            const name = c.Names[0]?.replace(/^\//, '') || '';
            return containerNames.some(n => name === n || name.includes(n));
          });

          return projectContainers.map((c) => {
            const composeInfo = composeContainers.find(cc => {
              const name = c.Names[0]?.replace(/^\//, '') || '';
              return name === cc.Name || name.includes(cc.Name);
            });
            return this.mapContainerInfo(c, projectName, composeInfo?.Service);
          });
        }
      } catch (error) {
        logger.debug('Failed to use docker-compose ps:', error);
      }
    }

    // Fallback 2: Фильтр по имени проекта в названии контейнера
    logger.debug('Using name-based filter as final fallback');
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
  async startContainer(serviceName: string, projectName: string, composeFile?: string, projectDir?: string): Promise<void> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.info(`Starting container: ${serviceName}`);
    await container.start();
    logger.info(`Container ${serviceName} started successfully`);
  }

  /**
   * Остановить контейнер
   */
  async stopContainer(serviceName: string, projectName: string, timeout = 10, composeFile?: string, projectDir?: string): Promise<void> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.info(`Stopping container: ${serviceName}`);
    await container.stop({ t: timeout });
    logger.info(`Container ${serviceName} stopped successfully`);
  }

  /**
   * Перезапустить контейнер
   */
  async restartContainer(serviceName: string, projectName: string, timeout = 10, composeFile?: string, projectDir?: string): Promise<void> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.info(`Restarting container: ${serviceName}`);
    await container.restart({ t: timeout });
    logger.info(`Container ${serviceName} restarted successfully`);
  }

  /**
   * Получить логи контейнера
   * Возвращает string для обычного режима или stream для follow mode
   */
  async getLogs(
    serviceName: string,
    projectName: string,
    options: LogOptions = {},
    composeFile?: string,
    projectDir?: string
  ): Promise<string | NodeJS.ReadableStream> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);

    logger.debug(`Getting logs for: ${serviceName}`, options);

    // Если follow mode → возвращаем stream
    if (options.follow) {
      logger.debug('Returning stream for follow mode');
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: options.lines || 100,
        follow: true,
        timestamps: options.timestamps || false,
        since: options.since,
      });
      return logs as NodeJS.ReadableStream;
    }

    // Иначе → возвращаем string
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.lines || 100,
      follow: false,
      timestamps: options.timestamps || false,
      since: options.since,
    });

    // logs теперь Buffer, конвертируем в string
    return Buffer.isBuffer(logs) ? logs.toString('utf-8') : (logs as Buffer).toString('utf-8');
  }

  /**
   * Получить health status контейнера
   */
  async getHealthStatus(serviceName: string, projectName: string, composeFile?: string, projectDir?: string): Promise<ContainerHealthStatus> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    try {
      const info = await container.inspect();
      
      // Если контейнер не running
      if (info.State.Status !== 'running') {
        return {
          status: 'not_running',
          checks: 0,
          failures: 0,
        };
      }
      
      // Если healthcheck не определён
      if (!info.State.Health) {
        return {
          status: 'none',
          checks: 0,
          failures: 0,
        };
      }
      
      // Healthcheck определён
      const health = info.State.Health;
      const status = health.Status as 'healthy' | 'unhealthy' | 'starting';
      
      return {
        status: status || 'none',
        checks: health.Log?.length || 0,
        failures: health.FailingStreak || 0,
      };
    } catch (error: any) {
      logger.error(`Failed to get health status for ${serviceName}:`, error);
      throw new Error(`Failed to inspect container: ${error.message}`);
    }
  }

  /**
   * Выполнить команду в контейнере
   */
  async exec(
    serviceName: string,
    projectName: string,
    command: string[],
    options: { user?: string; workdir?: string; env?: string[]; interactive?: boolean } = {},
    composeFile?: string,
    projectDir?: string
  ): Promise<string> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.debug(`Executing in ${serviceName}:`, command.join(' '));
    if (options.interactive) {
      logger.debug('Interactive mode (TTY) enabled');
    }

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: options.interactive || false,
      Tty: options.interactive || false,
      User: options.user,
      WorkingDir: options.workdir,
      Env: options.env,
    });

    const stream = await exec.start({
      hijack: options.interactive || false,
      stdin: options.interactive || false,
    });
    
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
  private async findContainer(serviceName: string, projectName: string, composeFile?: string, projectDir?: string): Promise<Docker.Container> {
    const containers = await this.listContainers(projectName, composeFile, projectDir);
    
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
  private mapContainerInfo(container: any, projectName: string, serviceNameOverride?: string): ContainerInfo {
    // Имя контейнера: /project_service_1 → извлекаем service
    const fullName = container.Names[0]?.replace(/^\//, '') || '';
    
    // Приоритет: override → label → извлечение из имени
    const serviceName = serviceNameOverride 
      || container.Labels?.['com.docker.compose.service']
      || this.extractServiceName(fullName, projectName);

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