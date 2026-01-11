/**
 * MCP Health Tool
 * MCP server self-diagnostics
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { getDockerClientForProfile } from '../utils/docker-client.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { adapterRegistry } from '../adapters/adapter-registry.js';
import { projectConfigCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

export class MCPHealthTool {
  constructor() {
    // Profile is resolved dynamically per-tool call from args.profile
  }

  /**
   * Register health tool
   */
  getTool(): Tool {
    return {
      name: 'docker_mcp_health',
      description: 'Check health status of the MCP server (self-diagnostics)',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  /**
   * Handle tool call
   */
  async handleCall(request: CallToolRequest) {
    try {
      const healthStatus = await this.check();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(healthStatus, null, 2),
          },
        ],
      };
    } catch (error: any) {
      logger.error('MCP health check failed:', error);
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
   * Perform health checks
   */
  async check(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    checks: {
      docker: {
        status: 'ok' | 'failed';
        message?: string;
        latency?: number;
        mode?: 'local' | 'remote';
      };
      ssh?: {
        status: 'ok' | 'not_configured';
        host?: string;
        port?: number;
        username?: string;
        tunnelActive?: boolean;
      };
      discovery: {
        status: 'ok' | 'failed';
        message?: string;
        projectFound?: boolean;
        projectName?: string;
      };
      adapters: {
        status: 'ok';
        registered: string[];
        count: number;
      };
      cache: {
        status: 'ok';
        size: number;
        ttl: number;
      };
      memory: {
        status: 'ok' | 'warning';
        heapUsed: number;
        heapTotal: number;
        rss: number;
      };
    };
  }> {
    const checks: any = {};

    // 1. Docker Connection (local only at startup)
    try {
      const start = Date.now();
      const docker = getDockerClientForProfile(); // Local Docker (no profile)
      await docker.ping();
      const latency = Date.now() - start;
      
      checks.docker = {
        status: 'ok' as const,
        latency,
        mode: 'local' as const,
      };
    } catch (error: any) {
      checks.docker = {
        status: 'failed' as const,
        message: error.message || 'Local Docker connection failed',
        mode: 'local' as const,
      };
    }

    // 2. SSH Status (profiles loaded from DOCKER_PROFILES ENV)
    try {
      const { getAvailableProfiles, getDefaultProfile } = await import('../utils/profile-resolver.js');
      const profiles = getAvailableProfiles();
      const defaultProfile = getDefaultProfile();
      
      if (profiles.length > 0 && defaultProfile !== 'local') {
        checks.ssh = {
          status: 'configured' as any, // Profiles available but connection tested per-tool
          message: `${profiles.length} profile(s) configured, default: ${defaultProfile}`,
        };
      } else {
        checks.ssh = {
          status: 'not_configured' as const,
        };
      }
    } catch (error: any) {
      checks.ssh = {
        status: 'not_configured' as const,
      };
    }

    // 3. Project Discovery
    try {
      const projectDiscovery = new ProjectDiscovery();
      const project = await projectDiscovery.findProject();
      
      checks.discovery = {
        status: 'ok' as const,
        projectFound: true,
        projectName: project.name,
      };
    } catch (error: any) {
      checks.discovery = {
        status: 'failed' as const,
        message: error.message || 'Project discovery failed',
        projectFound: false,
      };
    }

    // 4. Adapters Registry
    const registeredTypes = adapterRegistry.getRegisteredTypes();
    checks.adapters = {
      status: 'ok' as const,
      registered: registeredTypes,
      count: registeredTypes.length,
    };

    // 5. Cache Status
    checks.cache = {
      status: 'ok' as const,
      size: projectConfigCache.size(),
      ttl: 60, // seconds (hardcoded, as not exported in Cache)
    };

    // 6. Memory Usage
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    
    checks.memory = {
      status: heapUsedMB > 500 ? 'warning' as const : 'ok' as const,
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      rss: rssMB,
    };

    // Overall status
    const hasFailures = Object.values(checks).some(
      (check: any) => check.status === 'failed'
    );
    const hasWarnings = Object.values(checks).some(
      (check: any) => check.status === 'warning'
    );

    return {
      status: hasFailures ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()), // seconds
      checks,
    };
  }
}

