/**
 * Remote Project Discovery
 * Find and parse docker-compose projects on remote servers via SSH
 */

import { logger } from '../utils/logger.js';
import type { SSHConfig } from '../utils/ssh-config.js';
import { execSSH, readRemoteFile, findRemoteFiles } from '../utils/ssh-exec.js';
import { ComposeParser } from './compose-parser.js';
import type { ProjectConfig, ServiceConfig } from './types.js';
import type Docker from 'dockerode';
import { DockerClient } from '../utils/docker-client.js';

/**
 * Remote project discovery options
 */
export interface RemoteDiscoveryOptions {
  /** SSH config for remote server */
  sshConfig: SSHConfig;
  /** Docker client for remote server */
  dockerClient: Docker;
  /** Base path to search for projects (default: from profile or "/var/www") */
  basePath?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Discovered project information
 */
export interface DiscoveredProject {
  /** Project name (from docker-compose.yml or directory name) */
  name: string;
  /** Path to project directory */
  path: string;
  /** Path to docker-compose.yml file */
  composeFile: string;
  /** List of services from compose file */
  services: string[];
  /** Project status */
  status: 'running' | 'partial' | 'stopped';
  /** Number of running containers */
  runningContainers: number;
  /** Total number of services */
  totalServices: number;
  /** List of issues (if any) */
  issues: string[];
}

/**
 * Projects discovery result
 */
export interface ProjectsDiscoveryResult {
  /** List of discovered projects */
  projects: DiscoveredProject[];
  /** Summary statistics */
  summary: {
    total: number;
    running: number;
    partial: number;
    stopped: number;
  };
}

/**
 * Remote project discovery class
 */
export class RemoteProjectDiscovery {
  private dockerClientWrapper: DockerClient;
  private sshConfig: SSHConfig;
  private composeParser: ComposeParser;

  constructor(sshConfig: SSHConfig, dockerClientWrapper: DockerClient) {
    this.sshConfig = sshConfig;
    this.dockerClientWrapper = dockerClientWrapper;
    this.composeParser = new ComposeParser();
  }

  /**
   * Discover all docker-compose projects on remote server
   * Uses only Docker labels (fast mode) - no compose file reading (~2s)
   * For detailed info about specific project, use getProjectStatus()
   */
  async discoverProjects(options: RemoteDiscoveryOptions): Promise<ProjectsDiscoveryResult> {
    const { basePath, timeout = 60000 } = options;

    // Determine base path
    const projectsPath = basePath || (this.sshConfig as any).projectsPath || '/var/www';

    logger.info(`Discovering Docker projects in ${projectsPath} on ${this.sshConfig.host}`);

    try {
      return await this.discoverProjectsFast(projectsPath, timeout);
    } catch (error: any) {
      logger.error(`Failed to discover projects: ${error.message}`);
      throw error;
    }
  }

  /**
   * Discover projects using only Docker labels
   * No compose file reading - fast and scalable!
   * For detailed info about specific project, use getProjectStatus()
   */
  private async discoverProjectsFast(
    projectsPath: string,
    timeout: number
  ): Promise<ProjectsDiscoveryResult> {
    logger.debug('Discovering projects using Docker labels only');

    try {
      // Get ALL containers (running + stopped) with labels in ONE command
      const inspectResult = await execSSH(
        `docker ps -a -q | xargs -r docker inspect --format '{{.Name}}\t{{.State.Status}}\t{{index .Config.Labels "com.docker.compose.project"}}\t{{index .Config.Labels "com.docker.compose.service"}}\t{{index .Config.Labels "com.docker.compose.project.working_dir"}}'`,
        {
          sshConfig: this.sshConfig,
          timeout,
        }
      );

      if (inspectResult.code !== 0 || !inspectResult.stdout) {
        logger.warn('Failed to get containers via SSH, falling back to empty result');
        return {
          projects: [],
          summary: { total: 0, running: 0, partial: 0, stopped: 0 },
        };
      }

      // Parse results and group by project
      const projectsMap = new Map<string, {
        name: string;
        path: string;
        containers: Array<{ name: string; status: string; service: string }>;
        running: number;
        stopped: number;
      }>();

      const lines = inspectResult.stdout.trim().split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const [name, status, project, service, path] = line.split('\t');
        
        if (!name || !project || project.trim() === '') {
          continue; // Skip containers without compose project label
        }

        const cleanName = name.replace(/^\//, '').trim();
        const projectName = project.trim();
        const projectPath = (path || '').trim() || projectsPath;
        const containerStatus = status.trim();
        const serviceName = (service || '').trim();

        if (!projectsMap.has(projectName)) {
          projectsMap.set(projectName, {
            name: projectName,
            path: projectPath,
            containers: [],
            running: 0,
            stopped: 0,
          });
        }

        const projectData = projectsMap.get(projectName)!;
        projectData.containers.push({
          name: cleanName,
          status: containerStatus,
          service: serviceName,
        });

        if (containerStatus === 'running') {
          projectData.running++;
        } else {
          projectData.stopped++;
        }
      }

      // Convert to DiscoveredProject format
      const projects: DiscoveredProject[] = Array.from(projectsMap.values()).map(projectData => {
        const totalContainers = projectData.containers.length;
        let status: 'running' | 'partial' | 'stopped';
        
        if (projectData.running === totalContainers && totalContainers > 0) {
          status = 'running';
        } else if (projectData.running > 0) {
          status = 'partial';
        } else {
          status = 'stopped';
        }

        // Find issues
        const issues: string[] = [];
        for (const container of projectData.containers) {
          if (container.status === 'restarting') {
            issues.push(`${container.name}: restarting`);
          } else if (container.status === 'exited') {
            issues.push(`${container.name}: exited`);
          }
        }

        return {
          name: projectData.name,
          path: projectData.path,
          composeFile: `${projectData.path}/docker-compose.yml`, // Estimated path
          services: projectData.containers.map(c => c.service).filter(s => s), // Services from labels
          status,
          runningContainers: projectData.running,
          totalServices: totalContainers, // Approximate (from containers)
          issues,
        };
      });

      const summary = this.calculateSummary(projects);
      logger.info(`Discovered ${projects.length} projects: ${summary.running} running, ${summary.partial} partial, ${summary.stopped} stopped`);

      return {
        projects,
        summary,
      };
    } catch (error: any) {
      logger.error(`Discovery failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get running containers via SSH (more reliable than Docker API through tunnel)
   * Optimized: single command to get all containers with labels
   */
  private async getRunningContainersViaSSH(timeout: number): Promise<Map<string, { name: string; project: string; service: string; state: string }>> {
    const runningMap = new Map<string, { name: string; project: string; service: string; state: string }>();
    
    try {
      // Get all running containers with labels in ONE command (much faster!)
      const inspectResult = await execSSH(
        `docker ps -q | xargs -r docker inspect --format '{{.Name}}\t{{index .Config.Labels "com.docker.compose.project"}}\t{{index .Config.Labels "com.docker.compose.service"}}\t{{.State.Status}}'`,
        {
          sshConfig: this.sshConfig,
          timeout,
        }
      );
      
      if (inspectResult.code === 0 && inspectResult.stdout) {
        const lines = inspectResult.stdout.trim().split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          const [name, project, service, state] = line.split('\t');
          if (name && project) {
            // Remove leading slash from container name
            const cleanName = name.replace(/^\//, '');
            runningMap.set(cleanName, {
              name: cleanName,
              project: project.trim(),
              service: (service || '').trim(),
              state: (state || 'running').trim(),
            });
          }
        }
        
        logger.debug(`Found ${runningMap.size} running containers via SSH`);
      }
    } catch (error: any) {
      logger.warn(`Failed to get running containers via SSH: ${error.message}`);
    }
    
    return runningMap;
  }

  /**
   * Discover a single project from compose file
   */
  private async discoverProject(
    composeFile: string,
    allContainers: Docker.ContainerInfo[],
    runningContainersViaSSH: Map<string, { name: string; project: string; service: string; state: string }>,
    timeout: number
  ): Promise<DiscoveredProject | null> {
    try {
      // Read and parse compose file
      const composeContent = await readRemoteFile(composeFile, {
        sshConfig: this.sshConfig,
        timeout,
      });

      const projectConfig = this.composeParser.parseFromString(composeContent, composeFile);

      // Extract project name from directory
      const projectDir = composeFile.replace(/\/docker-compose\.yml$/, '').replace(/\/compose\.yml$/, '');
      const projectName = projectConfig.name || projectDir.split('/').pop() || 'unknown';

      // Get service names from compose
      const services = Object.keys(projectConfig.services || {});

      // Find containers for this project from Docker API
      const projectContainers = allContainers.filter(container => {
        const labels = container.Labels || {};
        return labels['com.docker.compose.project'] === projectName ||
               labels['com.docker.compose.project.working_dir'] === projectDir;
      });

      // Also check running containers via SSH (more reliable)
      const runningViaSSH = Array.from(runningContainersViaSSH.values()).filter(
        c => c.project === projectName
      );

      // Combine: use SSH data for running status, API data for stopped containers
      const runningContainerNames = new Set(runningViaSSH.map(c => c.name));
      const runningCount = runningContainerNames.size;
      
      // Match containers with services
      // Count running: use SSH data (more accurate)
      // Count stopped: use API data
      const stoppedContainers = projectContainers.filter(c => {
        const name = c.Names[0]?.replace(/^\//, '') || '';
        return !runningContainerNames.has(name) && c.State !== 'running';
      }).length;

      // Determine status based on running containers from SSH
      let status: 'running' | 'partial' | 'stopped';
      if (runningCount === services.length && services.length > 0) {
        status = 'running';
      } else if (runningCount > 0) {
        status = 'partial';
      } else {
        status = 'stopped';
      }

      // Find issues
      const issues: string[] = [];
      for (const container of projectContainers) {
        if (container.State === 'restarting') {
          const name = container.Names[0]?.replace(/^\//, '') || 'unknown';
          issues.push(`${name}: restarting`);
        } else if (container.State === 'exited' && container.Status?.includes('Exited')) {
          const name = container.Names[0]?.replace(/^\//, '') || 'unknown';
          const exitCode = container.Status.match(/Exited \((\d+)\)/)?.[1] || '?';
          issues.push(`${name}: exited with code ${exitCode}`);
        }
      }

      return {
        name: projectName,
        path: projectDir,
        composeFile,
        services,
        status,
        runningContainers: runningCount,
        totalServices: services.length,
        issues,
      };
    } catch (error: any) {
      logger.debug(`Failed to parse project from ${composeFile}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get detailed status for a specific project
   * Optimized: Uses Docker filter + path from label, NO find!
   */
  async getProjectStatus(
    projectName: string,
    options: RemoteDiscoveryOptions
  ): Promise<DiscoveredProject | null> {
    const { basePath, timeout = 30000 } = options;
    const projectsPath = basePath || (this.sshConfig as any).projectsPath || '/var/www';

    try {
      // Step 1: Get containers for this project ONLY via SSH filter (fast!)
      const inspectResult = await execSSH(
        `docker ps -a --filter label=com.docker.compose.project=${projectName} -q | xargs -r docker inspect --format '{{.Name}}\t{{.State.Status}}\t{{index .Config.Labels "com.docker.compose.service"}}\t{{index .Config.Labels "com.docker.compose.project.working_dir"}}'`,
        {
          sshConfig: this.sshConfig,
          timeout,
        }
      );

      if (inspectResult.code !== 0 || !inspectResult.stdout || inspectResult.stdout.trim() === '') {
        logger.debug(`No containers found for project: ${projectName}`);
        return null;
      }

      // Step 2: Parse first container to get project path
      const lines = inspectResult.stdout.trim().split('\n').filter(l => l.trim());
      if (lines.length === 0) {
        return null;
      }

      const firstLine = lines[0].split('\t');
      const projectPath = (firstLine[3] || '').trim() || projectsPath;

      // Step 3: Read compose file ONLY for this project (no find!)
      let composeFile = `${projectPath}/docker-compose.yml`;
      let composeContent: string;
      
      try {
        composeContent = await readRemoteFile(composeFile, {
          sshConfig: this.sshConfig,
          timeout,
        });
      } catch (error: any) {
        // Try alternative name
        composeFile = `${projectPath}/compose.yml`;
        try {
          composeContent = await readRemoteFile(composeFile, {
            sshConfig: this.sshConfig,
            timeout,
          });
        } catch (error2: any) {
          logger.warn(`Compose file not found for ${projectName} at ${projectPath}`);
          // Return basic info from labels only
          return this.getProjectStatusFromLabels(projectName, projectPath, lines);
        }
      }

      // Step 4: Parse compose and get full details
      const projectConfig = this.composeParser.parseFromString(composeContent, composeFile);
      const services = Object.keys(projectConfig.services || {});

      // Step 5: Get all containers for matching
      const allContainers = await this.dockerClientWrapper.listContainers({ all: true });
      const runningContainersViaSSH = await this.getRunningContainersViaSSH(timeout);

      // Step 6: Match containers with services
      const projectContainers = allContainers.filter(container => {
        const labels = container.Labels || {};
        return labels['com.docker.compose.project'] === projectName;
      });

      const runningViaSSH = Array.from(runningContainersViaSSH.values()).filter(
        c => c.project === projectName
      );

      const runningContainerNames = new Set(runningViaSSH.map(c => c.name));
      const runningCount = runningContainerNames.size;

      // Determine status
      let status: 'running' | 'partial' | 'stopped';
      if (runningCount === services.length && services.length > 0) {
        status = 'running';
      } else if (runningCount > 0) {
        status = 'partial';
      } else {
        status = 'stopped';
      }

      // Find issues
      const issues: string[] = [];
      for (const container of projectContainers) {
        if (container.State === 'restarting') {
          const name = container.Names[0]?.replace(/^\//, '') || 'unknown';
          issues.push(`${name}: restarting`);
        } else if (container.State === 'exited' && container.Status?.includes('Exited')) {
          const name = container.Names[0]?.replace(/^\//, '') || 'unknown';
          const exitCode = container.Status.match(/Exited \((\d+)\)/)?.[1] || '?';
          issues.push(`${name}: exited with code ${exitCode}`);
        }
      }

      return {
        name: projectName,
        path: projectPath,
        composeFile,
        services,
        status,
        runningContainers: runningCount,
        totalServices: services.length,
        issues,
      };
    } catch (error: any) {
      logger.error(`Failed to get project status for ${projectName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get basic project status from labels only (fallback when compose file not found)
   */
  private getProjectStatusFromLabels(
    projectName: string,
    projectPath: string,
    containerLines: string[]
  ): DiscoveredProject {
    let running = 0;
    let stopped = 0;
    const services: string[] = [];
    const issues: string[] = [];

    for (const line of containerLines) {
      const [name, status, service] = line.split('\t');
      if (service && service.trim()) {
        services.push(service.trim());
      }
      if (status.trim() === 'running') {
        running++;
      } else {
        stopped++;
        if (status.trim() === 'restarting') {
          issues.push(`${name.replace(/^\//, '')}: restarting`);
        } else if (status.trim() === 'exited') {
          issues.push(`${name.replace(/^\//, '')}: exited`);
        }
      }
    }

    let status: 'running' | 'partial' | 'stopped';
    const total = running + stopped;
    if (running === total && total > 0) {
      status = 'running';
    } else if (running > 0) {
      status = 'partial';
    } else {
      status = 'stopped';
    }

    return {
      name: projectName,
      path: projectPath,
      composeFile: `${projectPath}/docker-compose.yml`,
      services: [...new Set(services)], // Unique services
      status,
      runningContainers: running,
      totalServices: total,
      issues,
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(projects: DiscoveredProject[]): {
    total: number;
    running: number;
    partial: number;
    stopped: number;
  } {
    return {
      total: projects.length,
      running: projects.filter(p => p.status === 'running').length,
      partial: projects.filter(p => p.status === 'partial').length,
      stopped: projects.filter(p => p.status === 'stopped').length,
    };
  }
}
