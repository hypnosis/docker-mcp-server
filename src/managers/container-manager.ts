/**
 * Container Manager
 * Docker container management
 */

import type Docker from 'dockerode';
import { logger } from '../utils/logger.js';
import { getDockerClient } from '../utils/docker-client.js';
import { retryWithTimeout, createNetworkRetryPredicate } from '../utils/retry.js';
import type { SSHConfig } from '../utils/ssh-config.js';

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

export interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
  created: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
}

export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
}

export interface ContainerStats {
  id: string;
  name: string;
  cpuPercent: string;
  memoryUsage: string;
  memoryPercent: string;
  netIO: string;
  blockIO: string;
}

export class ContainerManager {
  private docker: Docker;
  private isRemote: boolean;

  constructor(sshConfig?: SSHConfig | null) {
    this.isRemote = !!sshConfig;
    const client = getDockerClient(sshConfig);
    this.docker = client.getClient();
  }

  /**
   * Execute Docker API call with retry for remote connections
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isRemote) {
      return retryWithTimeout(fn, {
        maxAttempts: 3,
        timeout: 30000,
        shouldRetry: createNetworkRetryPredicate(),
      });
    }
    return fn();
  }

  /**
   * List project containers
   * Shows all containers with Docker Compose labels (com.docker.compose.*)
   */
  async listContainers(projectName: string, composeFile?: string, projectDir?: string): Promise<ContainerInfo[]> {
    // Get ALL containers with ANY compose labels
    try {
      const allContainers = await this.withRetry(() => 
        this.docker.listContainers({ all: true })
      );

      // Filter containers that have Docker Compose labels
      const containersWithLabels = allContainers.filter(container => {
        const labels = container.Labels || {};
        // Check if container has any compose labels
        return Object.keys(labels).some(key => key.startsWith('com.docker.compose.'));
      });

      // If project name is specified, filter by project label
      if (projectName) {
        const projectContainers = containersWithLabels.filter(container => {
          const labels = container.Labels || {};
          return labels['com.docker.compose.project'] === projectName;
        });

        if (projectContainers.length > 0) {
          return projectContainers.map((c) => this.mapContainerInfo(c, projectName));
        }
      }

      // Return all containers with compose labels (if no project specified or project not found)
      return containersWithLabels.map((c) => {
        const labels = c.Labels || {};
        const containerProject = labels['com.docker.compose.project'] || projectName || 'unknown';
        return this.mapContainerInfo(c, containerProject);
      });
    } catch (error) {
      logger.error('Failed to list containers:', error);
      return [];
    }
  }

  /**
   * Start container
   */
  async startContainer(serviceName: string, projectName: string, composeFile?: string, projectDir?: string): Promise<void> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.info(`Starting container: ${serviceName}`);
    await this.withRetry(() => container.start());
    logger.info(`Container ${serviceName} started successfully`);
  }

  /**
   * Stop container
   */
  async stopContainer(serviceName: string, projectName: string, timeout = 10, composeFile?: string, projectDir?: string): Promise<void> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.info(`Stopping container: ${serviceName}`);
    await this.withRetry(() => container.stop({ t: timeout }));
    logger.info(`Container ${serviceName} stopped successfully`);
  }

  /**
   * Restart container
   */
  async restartContainer(serviceName: string, projectName: string, timeout = 10, composeFile?: string, projectDir?: string): Promise<void> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.info(`Restarting container: ${serviceName}`);
    await this.withRetry(() => container.restart({ t: timeout }));
    logger.info(`Container ${serviceName} restarted successfully`);
  }

  /**
   * Get container logs
   * Returns string for normal mode or stream for follow mode
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

    // If follow mode → return stream
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

    // Otherwise → return string
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.lines || 100,
      follow: false,
      timestamps: options.timestamps || false,
      since: options.since,
    });

    // logs is now Buffer, convert to string
    return Buffer.isBuffer(logs) ? logs.toString('utf-8') : (logs as Buffer).toString('utf-8');
  }

  /**
   * Get container health status
   */
  async getHealthStatus(serviceName: string, projectName: string, composeFile?: string, projectDir?: string): Promise<ContainerHealthStatus> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    try {
      const info = await this.withRetry(() => container.inspect());
      
      // If container is not running
      if (info.State.Status !== 'running') {
        return {
          status: 'not_running',
          checks: 0,
          failures: 0,
        };
      }
      
      // If healthcheck is not defined
      if (!info.State.Health) {
        return {
          status: 'none',
          checks: 0,
          failures: 0,
        };
      }
      
      // Healthcheck is defined
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
   * Execute command in container
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

    const exec = await this.withRetry(() => 
      container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: options.interactive || false,
        Tty: options.interactive || false,
        User: options.user,
        WorkingDir: options.workdir,
        Env: options.env,
      })
    );

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
   * Find container by service name
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
   * Map Docker ContainerInfo → our format
   */
  private mapContainerInfo(container: any, projectName: string, serviceNameOverride?: string): ContainerInfo {
    // Container name: /project_service_1 → extract service
    const fullName = container.Names[0]?.replace(/^\//, '') || '';
    
    // Priority: override → label → extraction from name
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
   * Extract ports from Docker container info
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
   * Extract service name from container name
   * project_service_1 → service
   * project-service-1 → service
   */
  private extractServiceName(containerName: string, projectName: string): string {
    // Remove project name from beginning
    let name = containerName;
    
    if (name.startsWith(projectName)) {
      name = name.slice(projectName.length);
    }

    // Remove separators and number at the end
    // project_service_1 → _service_1 → service_1 → service
    name = name.replace(/^[_-]/, '').replace(/[_-]\d+$/, '');

    return name || containerName; // Fallback to full name
  }

  /**
   * List Docker images
   */
  async listImages(): Promise<ImageInfo[]> {
    logger.debug('Listing Docker images');
    
    try {
      const images = await this.withRetry(() => 
        this.docker.listImages({ all: false })
      );
      
      return images.map((img) => ({
        id: img.Id.replace('sha256:', '').slice(0, 12),
        tags: img.RepoTags || ['<none>'],
        size: img.Size,
        created: new Date(img.Created * 1000).toISOString(),
      }));
    } catch (error: any) {
      logger.error('Failed to list images:', error);
      throw new Error(`Failed to list Docker images: ${error.message}`);
    }
  }

  /**
   * List Docker volumes
   */
  async listVolumes(): Promise<VolumeInfo[]> {
    logger.debug('Listing Docker volumes');
    
    try {
      const result = await this.withRetry(() =>
        this.docker.listVolumes()
      );
      const volumes = result.Volumes || [];
      
      return volumes.map((vol) => ({
        name: vol.Name,
        driver: vol.Driver,
        mountpoint: vol.Mountpoint,
        created: (vol as any).CreatedAt || 'N/A',
      }));
    } catch (error: any) {
      logger.error('Failed to list volumes:', error);
      throw new Error(`Failed to list Docker volumes: ${error.message}`);
    }
  }

  /**
   * List Docker networks
   */
  async listNetworks(): Promise<NetworkInfo[]> {
    logger.debug('Listing Docker networks');
    
    try {
      const networks = await this.withRetry(() =>
        this.docker.listNetworks()
      );
      
      return networks.map((net) => ({
        id: net.Id.slice(0, 12),
        name: net.Name,
        driver: net.Driver,
        scope: net.Scope,
        created: net.Created || 'N/A',
      }));
    } catch (error: any) {
      logger.error('Failed to list networks:', error);
      throw new Error(`Failed to list Docker networks: ${error.message}`);
    }
  }

  /**
   * Get container stats (CPU, Memory, Network, Block I/O)
   */
  async getContainerStats(serviceName: string, projectName: string, composeFile?: string, projectDir?: string): Promise<ContainerStats> {
    const container = await this.findContainer(serviceName, projectName, composeFile, projectDir);
    
    logger.debug(`Getting stats for: ${serviceName}`);
    
    try {
      const stats = await this.withRetry(() => container.stats({ stream: false }));
      
      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = systemDelta > 0 && cpuDelta > 0
        ? ((cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100).toFixed(2)
        : '0.00';
      
      // Calculate memory usage
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryPercent = memoryLimit > 0
        ? ((memoryUsage / memoryLimit) * 100).toFixed(2)
        : '0.00';
      
      // Format memory usage (MB)
      const memoryUsageMB = (memoryUsage / 1024 / 1024).toFixed(2);
      const memoryLimitMB = (memoryLimit / 1024 / 1024).toFixed(2);
      
      // Network I/O
      const networks = stats.networks || {};
      let rxBytes = 0;
      let txBytes = 0;
      Object.values(networks).forEach((net: any) => {
        rxBytes += net.rx_bytes || 0;
        txBytes += net.tx_bytes || 0;
      });
      const netIO = `${(rxBytes / 1024 / 1024).toFixed(2)}MB / ${(txBytes / 1024 / 1024).toFixed(2)}MB`;
      
      // Block I/O
      const blkRead = stats.blkio_stats?.io_service_bytes_recursive?.find((item: any) => item.op === 'read')?.value || 0;
      const blkWrite = stats.blkio_stats?.io_service_bytes_recursive?.find((item: any) => item.op === 'write')?.value || 0;
      const blockIO = `${(blkRead / 1024 / 1024).toFixed(2)}MB / ${(blkWrite / 1024 / 1024).toFixed(2)}MB`;
      
      const containerInfo = await container.inspect();
      const containerName = containerInfo.Name.replace(/^\//, '');
      
      return {
        id: container.id.slice(0, 12),
        name: containerName,
        cpuPercent: `${cpuPercent}%`,
        memoryUsage: `${memoryUsageMB}MB / ${memoryLimitMB}MB`,
        memoryPercent: `${memoryPercent}%`,
        netIO,
        blockIO,
      };
    } catch (error: any) {
      logger.error(`Failed to get stats for ${serviceName}:`, error);
      throw new Error(`Failed to get container stats: ${error.message}`);
    }
  }
}