/**
 * Docker Client Wrapper
 * Centralized Docker API management with SSH tunnel support
 */

import Docker from 'dockerode';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { logger } from './logger.js';
import type { SSHConfig } from './ssh-config.js';
import { retryWithTimeout, createNetworkRetryPredicate } from './retry.js';
import { loadProfilesFile, profileDataToSSHConfig } from './profiles-file.js';

/**
 * Dockerode wrapper for centralized Docker API management
 */
export class DockerClient {
  private docker: Docker;
  private sshConfig: SSHConfig | null;
  private isRemote: boolean;
  private activeSocketPath: string | null = null;
  private sshProcessPid: number | null = null;
  private tunnelCreationLock: Promise<string> | null = null;
  private tunnelHealthCheckInterval: NodeJS.Timeout | null = null;

  constructor(sshConfig?: SSHConfig | null) {
    this.sshConfig = sshConfig || null;
    this.isRemote = !!this.sshConfig;

    if (this.sshConfig) {
      // For SSH, create temporary Docker client, tunnel will be created on first use
      // Use local socket by default, will be replaced after tunnel creation
      this.docker = new Docker();
      logger.info(`Dockerode client initialized with SSH config (${this.sshConfig.host}:${this.sshConfig.port || 22})`);
    } else {
      // Local Docker client
      this.docker = new Docker();
      logger.debug('Dockerode client initialized (local)');
    }
  }

  /**
   * Cleanup SSH tunnel (called on shutdown)
   */
  cleanup(): void {
    // Stop healthcheck interval
    if (this.tunnelHealthCheckInterval) {
      clearInterval(this.tunnelHealthCheckInterval);
      this.tunnelHealthCheckInterval = null;
    }

    if (!this.isRemote || !this.activeSocketPath) {
      return;
    }

    logger.info('Cleaning up SSH tunnel...');

    // Remove socket file
    try {
      if (existsSync(this.activeSocketPath)) {
        unlinkSync(this.activeSocketPath);
        logger.debug(`Removed SSH socket: ${this.activeSocketPath}`);
      }
    } catch (error: any) {
      logger.warn(`Failed to remove SSH socket: ${error.message}`);
    }

    // Kill SSH process if we have PID
    if (this.sshProcessPid) {
      try {
        process.kill(this.sshProcessPid, 'SIGTERM');
        logger.debug(`Killed SSH process: ${this.sshProcessPid}`);
      } catch (error: any) {
        // Process might already be dead
        logger.debug(`SSH process already terminated: ${this.sshProcessPid}`);
      }
    }

    this.activeSocketPath = null;
    this.sshProcessPid = null;
  }


  /**
   * Ensure SSH tunnel is created and recreate Docker client with correct socket
   * With mutex to prevent race conditions
   */
  private async ensureSSHTunnel(): Promise<void> {
    if (!this.sshConfig) {
      return;
    }

    // If tunnel creation is already in progress, wait for it
    if (this.tunnelCreationLock) {
      logger.debug('Tunnel creation already in progress, waiting...');
      await this.tunnelCreationLock;
      return;
    }

    logger.info(`Ensuring SSH tunnel is created for ${this.sshConfig.host}:${this.sshConfig.port || 22}`);
    
    // Create lock and start tunnel creation
    this.tunnelCreationLock = (async () => {
      try {
        const socketPath = await this.createSSHTunnel(this.sshConfig!);
        
        // Store active socket path for cleanup
        this.activeSocketPath = socketPath;
        
        // Recreate Docker client with correct socket
        this.docker = new Docker({
          socketPath: socketPath,
        });
        
        logger.info(`Docker client updated with SSH tunnel socket: ${socketPath}`);
        
        // Start periodic healthcheck for tunnel
        this.startTunnelHealthCheck();
        
        return socketPath;
      } catch (error: any) {
        logger.error(`Failed to ensure SSH tunnel: ${error.message}`);
        throw error;
      } finally {
        // Release lock
        this.tunnelCreationLock = null;
      }
    })();
    
    await this.tunnelCreationLock;
  }

  /**
   * Start periodic healthcheck for SSH tunnel
   */
  private startTunnelHealthCheck(): void {
    // Clear existing interval if any
    if (this.tunnelHealthCheckInterval) {
      clearInterval(this.tunnelHealthCheckInterval);
    }

    // Check tunnel every 60 seconds
    this.tunnelHealthCheckInterval = setInterval(async () => {
      if (!this.activeSocketPath || !this.isRemote) {
        return;
      }

      try {
        // Quick ping to check if Docker is reachable
        await this.docker.ping();
        logger.debug('SSH tunnel healthcheck: OK');
      } catch (error: any) {
        logger.warn(`SSH tunnel healthcheck failed: ${error.message}`);
        logger.info('Attempting to recreate SSH tunnel...');
        
        // Try to recreate tunnel
        try {
          await this.ensureSSHTunnel();
          logger.info('SSH tunnel recreated successfully');
        } catch (recreateError: any) {
          logger.error(`Failed to recreate SSH tunnel: ${recreateError.message}`);
        }
      }
    }, 60000); // 60 seconds

    // Unref the interval so it doesn't keep the process alive
    this.tunnelHealthCheckInterval.unref();

    logger.debug('SSH tunnel healthcheck started (60s interval)');
  }

  /**
   * Create SSH tunnel to remote Docker socket
   * @returns Path to local socket file
   */
  private async createSSHTunnel(config: SSHConfig): Promise<string> {
    // Check platform support for Unix sockets
    if (process.platform === 'win32') {
      throw new Error('SSH tunneling with Unix sockets is not supported on Windows. Please use WSL2 or Docker Desktop.');
    }

    // Unique name for socket file
    const socketPath = join(tmpdir(), `docker-ssh-${config.host}-${config.port || 22}.sock`);
    
    // Check if tunnel is already running
    if (existsSync(socketPath)) {
      // Проверяем, работает ли туннель — пробуем подключиться
      logger.debug(`SSH tunnel socket exists: ${socketPath}, checking if it's alive...`);
      
      try {
        // Try quick ping through existing socket
        const testDocker = new Docker({ socketPath });
        await testDocker.ping();
        logger.debug(`SSH tunnel socket is alive: ${socketPath}`);
        return socketPath;
      } catch {
        // Socket file exists but tunnel is dead - remove and recreate
        logger.warn(`SSH tunnel socket exists but is dead, recreating: ${socketPath}`);
        try {
          unlinkSync(socketPath);
        } catch {
          // Ignore deletion error
        }
      }
    }

    // Check SSH key existence (if specified)
    if (config.privateKeyPath) {
      const keyPath = this.resolveKeyPath(config.privateKeyPath);
      
      if (!existsSync(keyPath)) {
        logger.warn(`SSH private key not found at: ${keyPath}. Make sure it's accessible via SSH agent or ~/.ssh/config`);
      } else {
        logger.debug(`SSH key found at: ${keyPath}`);
      }
    }

    // Build SSH command for tunnel creation
    const sshArgs = [
      '-N', // Don't execute commands, tunnel only
      '-f', // Background mode
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'ServerAliveInterval=60',
      '-o', 'ServerAliveCountMax=3',
      '-L', `${socketPath}:/var/run/docker.sock`, // Local socket -> remote socket
    ];

    // Add key if specified
    if (config.privateKeyPath) {
      const keyPath = this.resolveKeyPath(config.privateKeyPath);
      sshArgs.push('-i', keyPath);
    }

    // Add port and host
    if (config.port && config.port !== 22) {
      sshArgs.push('-p', String(config.port));
    }
    
    sshArgs.push(`${config.username}@${config.host}`);

    // Start SSH tunnel
    logger.info(`Creating SSH tunnel: ${config.username}@${config.host}:${config.port || 22}`);
    
    return new Promise<string>((resolve, reject) => {
      try {
        logger.debug(`Executing SSH command: ssh ${sshArgs.join(' ')}`);
        
        const sshProcess = spawn('ssh', sshArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        });

        // Store PID for cleanup
        if (sshProcess.pid) {
          this.sshProcessPid = sshProcess.pid;
          logger.debug(`SSH process PID: ${this.sshProcessPid}`);
        }

        let stderrOutput = '';
        let stdoutOutput = '';

        sshProcess.stdout?.on('data', (data) => {
          stdoutOutput += data.toString();
        });

        sshProcess.stderr?.on('data', (data) => {
          stderrOutput += data.toString();
          // Логируем stderr для отладки
          logger.debug(`SSH stderr: ${data.toString().trim()}`);
        });

        sshProcess.on('error', (error) => {
          logger.error(`SSH tunnel process error: ${error.message}`);
          reject(new Error(`SSH tunnel failed: ${error.message}`));
        });

        // With -f flag, process exits immediately after starting in background
        // Wait a bit and check socket
        setTimeout(() => {
          sshProcess.unref();
          
          // Wait for socket creation
          this.waitForSocket(socketPath, 10000) // Increase timeout to 10 seconds
            .then(() => {
              logger.info(`SSH tunnel socket created successfully: ${socketPath}`);
              // Store socket path for cleanup
              this.activeSocketPath = socketPath;
              resolve(socketPath);
            })
            .catch((error: any) => {
              logger.error(`SSH tunnel socket not created: ${error.message}`);
              if (stderrOutput) {
                logger.error(`SSH stderr output: ${stderrOutput}`);
              }
              if (stdoutOutput) {
                logger.error(`SSH stdout output: ${stdoutOutput}`);
              }
              reject(new Error(`SSH tunnel socket not created: ${error.message}`));
            });
        }, 500); // Give 500ms for process startup
        
      } catch (error: any) {
        logger.error(`Failed to start SSH tunnel: ${error.message}`);
        reject(new Error(`SSH tunnel failed: ${error.message}`));
      }
    });
  }

  /**
   * Wait for socket file creation
   */
  private async waitForSocket(socketPath: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 100; // Проверяем каждые 100ms

    return new Promise<void>((resolve, reject) => {
      const checkSocket = setInterval(() => {
        if (existsSync(socketPath)) {
          clearInterval(checkSocket);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkSocket);
          reject(new Error(`Socket not created within ${timeout}ms`));
        }
      }, checkInterval);
    });
  }

  /**
   * Resolve SSH key path (support for ~)
   */
  private resolveKeyPath(keyPath: string): string {
    if (keyPath.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return keyPath.replace('~', home);
    }
    return resolve(keyPath);
  }

  /**
   * Проверка подключения к Docker
   * С retry логикой для удаленных подключений
   */
  async ping(): Promise<void> {
    // Для удаленных подключений сначала создаем туннель
    if (this.isRemote) {
      await this.ensureSSHTunnel();
    }

    const pingFn = async () => {
      await this.docker.ping();
      logger.info(`Docker connection verified${this.isRemote ? ` (remote: ${this.sshConfig?.host})` : ' (local)'}`);
    };

    try {
      // Для удаленных подключений используем retry
      if (this.isRemote) {
        await retryWithTimeout(pingFn, {
          maxAttempts: 3,
          timeout: 30000,
          shouldRetry: createNetworkRetryPredicate(),
        });
      } else {
        await pingFn();
      }
    } catch (error: any) {
      const errorMessage = this.isRemote
        ? `Failed to connect to remote Docker at ${this.sshConfig?.host}: ${error.message}`
        : 'Docker is not running. Please start Docker Desktop and try again.';
      
      logger.error('Docker connection failed:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Get native Dockerode instance
   */
  getClient(): Docker {
    return this.docker;
  }

  /**
   * List containers
   * With retry logic for remote connections
   */
  async listContainers(options?: Docker.ContainerListOptions) {
    // Для удаленных подключений сначала создаем туннель
    if (this.isRemote) {
      await this.ensureSSHTunnel();
    }

    const listFn = async () => {
    return this.docker.listContainers(options);
    };

    // Для удаленных подключений используем retry
    if (this.isRemote) {
      return retryWithTimeout(listFn, {
        maxAttempts: 3,
        timeout: 30000,
        shouldRetry: createNetworkRetryPredicate(),
      });
    }

    return listFn();
  }

  /**
   * Get container by ID or name
   */
  getContainer(id: string): Docker.Container {
    return this.docker.getContainer(id);
  }
}

// Singleton instance
let dockerClientInstance: DockerClient | null = null;

/**
 * Get singleton instance of DockerClient
 * @param sshConfig - SSH configuration (optional, for remote Docker)
 */
export function getDockerClient(sshConfig?: SSHConfig | null): DockerClient {
  // Если конфигурация изменилась, пересоздаем клиент
  if (!dockerClientInstance || sshConfig !== undefined) {
    // Cleanup old instance if exists
    if (dockerClientInstance) {
      dockerClientInstance.cleanup();
    }
    dockerClientInstance = new DockerClient(sshConfig);
  }
  return dockerClientInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetDockerClient(): void {
  if (dockerClientInstance) {
    dockerClientInstance.cleanup();
  }
  dockerClientInstance = null;
}

/**
 * Cleanup all Docker clients (for graceful shutdown)
 */
export function cleanupDockerClient(): void {
  if (dockerClientInstance) {
    dockerClientInstance.cleanup();
  }
}

// ============================================================================
// Profile-based Docker Client Pool
// ============================================================================

/**
 * Pool of Docker clients by profile name
 * Allows parallel access to multiple Docker environments (local and remote)
 */
const clientPool: Map<string, DockerClient> = new Map();

/**
 * Local Docker client (cached)
 */
let localDockerClient: DockerClient | null = null;

/**
 * Load profile configuration from profiles.json
 * @param profileName - Profile name to load
 * @returns SSHConfig or null for local mode
 * @throws Error if profile not found or invalid
 */
function loadProfileConfig(profileName: string): SSHConfig | null {
  const profilesFile = process.env.DOCKER_MCP_PROFILES_FILE;
  
  if (!profilesFile) {
    throw new Error('DOCKER_MCP_PROFILES_FILE environment variable not set. Cannot load profile.');
  }

  // Load profiles file (synchronous!)
  const fileResult = loadProfilesFile(profilesFile);
  
  if (fileResult.errors.length > 0) {
    throw new Error(`Failed to load profiles file: ${fileResult.errors.join(', ')}`);
  }
  
  if (!fileResult.config) {
    throw new Error(`Profiles file not found or empty: ${profilesFile}`);
  }
  
  // Get profile data
  const profileData = fileResult.config.profiles[profileName];
  if (!profileData) {
    const available = Object.keys(fileResult.config.profiles).join(', ');
    throw new Error(`Profile "${profileName}" not found. Available profiles: ${available}`);
  }
  
  // Check if local mode
  if (profileData.mode === 'local') {
    logger.info(`Profile "${profileName}" is configured for LOCAL mode`);
    return null;
  }
  
  // Convert to SSHConfig
  try {
    const config = profileDataToSSHConfig(profileData);
    logger.info(`Profile "${profileName}" loaded for REMOTE mode (${config.host})`);
    return config;
  } catch (error: any) {
    if (error.code === 'LOCAL_MODE') {
      logger.info(`Profile "${profileName}" is configured for LOCAL mode`);
      return null;
    }
    throw error;
  }
}

/**
 * Get Docker client for specific profile
 * @param profileName - Profile name (undefined = local Docker)
 * @returns DockerClient instance
 * 
 * @example
 * // Local Docker (default)
 * const localClient = getDockerClientForProfile();
 * 
 * // Remote Docker (production profile)
 * const prodClient = getDockerClientForProfile('production');
 */
export function getDockerClientForProfile(profileName?: string): DockerClient {
  // No profile specified = local Docker
  if (!profileName) {
    if (!localDockerClient) {
      localDockerClient = new DockerClient();
      logger.debug('Created LOCAL Docker client');
    }
    return localDockerClient;
  }
  
  // Check if client already exists in pool
  if (clientPool.has(profileName)) {
    logger.debug(`Using cached Docker client for profile: ${profileName}`);
    return clientPool.get(profileName)!;
  }
  
  // Load profile configuration (synchronous!)
  logger.info(`Loading Docker client for profile: ${profileName}`);
  const sshConfig = loadProfileConfig(profileName);
  
  // Create client (local or remote based on config)
  const client = new DockerClient(sshConfig);
  
  // Cache in pool
  clientPool.set(profileName, client);
  logger.info(`Docker client cached for profile: ${profileName}`);
  
  return client;
}

/**
 * Clear client pool (for testing or cleanup)
 */
export function clearClientPool(): void {
  logger.info(`Clearing Docker client pool (${clientPool.size} clients)`);
  
  // Cleanup all clients in pool
  for (const [profileName, client] of clientPool.entries()) {
    try {
      client.cleanup();
      logger.debug(`Cleaned up client for profile: ${profileName}`);
    } catch (error: any) {
      logger.warn(`Failed to cleanup client for profile ${profileName}: ${error.message}`);
    }
  }
  
  clientPool.clear();
  
  // Cleanup local client
  if (localDockerClient) {
    try {
      localDockerClient.cleanup();
      logger.debug('Cleaned up LOCAL Docker client');
    } catch (error: any) {
      logger.warn(`Failed to cleanup local client: ${error.message}`);
    }
    localDockerClient = null;
  }
}

/**
 * Cleanup all Docker clients in pool (for graceful shutdown)
 */
export function cleanupAllDockerClients(): void {
  // Cleanup singleton
  cleanupDockerClient();
  
  // Cleanup pool
  clearClientPool();
}