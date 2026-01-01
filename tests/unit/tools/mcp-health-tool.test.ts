/**
 * Tests for MCPHealthTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPHealthTool } from '../../../src/tools/mcp-health-tool.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

// Mock all dependencies WITHOUT factory functions to avoid hoisting issues
vi.mock('../../../src/utils/docker-client.js');
vi.mock('../../../src/discovery/project-discovery.js');
vi.mock('../../../src/adapters/adapter-registry.js');
vi.mock('../../../src/utils/cache.js');
vi.mock('../../../src/utils/logger.js');

// Import mocked modules AFTER vi.mock
const { getDockerClient } = await import('../../../src/utils/docker-client.js');
const { ProjectDiscovery } = await import('../../../src/discovery/project-discovery.js');
const { adapterRegistry } = await import('../../../src/adapters/adapter-registry.js');
const { projectConfigCache } = await import('../../../src/utils/cache.js');

describe('MCPHealthTool', () => {
  let healthTool: MCPHealthTool;
  let mockDockerPing: any;
  let mockProjectDiscoveryInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup Docker mock
    mockDockerPing = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDockerClient).mockReturnValue({
      ping: mockDockerPing,
    } as any);

    // Setup ProjectDiscovery mock - create mock findProject function
    const mockFindProject = vi.fn().mockResolvedValue({
      name: 'test-project',
      composeFile: '/test/docker-compose.yml',
      projectDir: '/test',
      services: {},
    });
    
    mockProjectDiscoveryInstance = {
      findProject: mockFindProject,
    };
    
    // Mock ProjectDiscovery as a class constructor
    (ProjectDiscovery as any).mockImplementation(function(this: any) {
      this.findProject = mockFindProject;
      return this;
    });

    // Setup adapter registry mock
    vi.mocked(adapterRegistry.getRegisteredTypes).mockReturnValue(['postgresql', 'redis', 'sqlite']);

    // Setup cache mock
    vi.mocked(projectConfigCache.size).mockReturnValue(5);
    
    healthTool = new MCPHealthTool();
  });

  describe('getTool', () => {
    it('should return tool definition', () => {
      const tool = healthTool.getTool();

      expect(tool.name).toBe('docker_mcp_health');
      expect(tool.description).toContain('health status');
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  describe('check', () => {
    it('should return healthy status when all checks pass', async () => {
      const result = await healthTool.check();

      expect(result.status).toBe('healthy');
      expect(result.checks.docker.status).toBe('ok');
      expect(result.checks.discovery.status).toBe('ok');
      expect(result.checks.adapters.status).toBe('ok');
      expect(result.checks.cache.status).toBe('ok');
      expect(result.checks.memory.status).toBe('ok');
      expect(result.checks.docker.latency).toBeGreaterThanOrEqual(0);
      expect(result.checks.discovery.projectFound).toBe(true);
      expect(result.checks.adapters.registered).toEqual(['postgresql', 'redis', 'sqlite']);
      expect(result.checks.adapters.count).toBe(3);
      expect(result.checks.cache.size).toBe(5);
      expect(typeof result.timestamp).toBe('string');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when Docker check fails', async () => {
      mockDockerPing.mockRejectedValue(new Error('Docker daemon not running'));

      const result = await healthTool.check();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.docker.status).toBe('failed');
      expect(result.checks.docker.message).toContain('Docker daemon');
    });

    it('should return unhealthy status when Project Discovery fails', async () => {
      mockProjectDiscoveryInstance.findProject.mockRejectedValue(new Error('No docker-compose.yml found'));

      const result = await healthTool.check();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.discovery.status).toBe('failed');
      expect(result.checks.discovery.projectFound).toBe(false);
      expect(result.checks.discovery.message).toContain('docker-compose.yml');
    });

    it('should return degraded status when memory usage is high', async () => {
      // Mock high memory usage (>500MB heap)
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = vi.fn(() => ({
        heapUsed: 600 * 1024 * 1024, // 600 MB
        heapTotal: 800 * 1024 * 1024,
        rss: 1000 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
      }));

      const result = await healthTool.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.memory.status).toBe('warning');
      expect(result.checks.memory.heapUsed).toBe(600);

      // Restore original
      process.memoryUsage = originalMemoryUsage;
    });

    it('should include Docker latency in check', async () => {
      // Simulate some latency
      mockDockerPing.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10)));

      const result = await healthTool.check();

      expect(result.checks.docker.latency).toBeGreaterThanOrEqual(0);
    });

    it('should include project name in discovery check', async () => {
      mockProjectDiscoveryInstance.findProject.mockResolvedValue({
        name: 'my-custom-project',
        composeFile: '/path/compose.yml',
        projectDir: '/path',
        services: {},
      });

      const result = await healthTool.check();

      expect(result.checks.discovery.projectName).toBe('my-custom-project');
    });

    it('should handle empty adapter registry', async () => {
      vi.mocked(adapterRegistry.getRegisteredTypes).mockReturnValue([]);

      const result = await healthTool.check();

      expect(result.checks.adapters.status).toBe('ok');
      expect(result.checks.adapters.count).toBe(0);
      expect(result.checks.adapters.registered).toEqual([]);
    });

    it('should handle empty cache', async () => {
      vi.mocked(projectConfigCache.size).mockReturnValue(0);

      const result = await healthTool.check();

      expect(result.checks.cache.size).toBe(0);
      expect(result.checks.cache.status).toBe('ok');
    });
  });

  describe('handleCall', () => {
    it('should return health status in MCP format', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'docker_mcp_health',
          arguments: {},
        },
      } as any;

      const result = await healthTool.handleCall(request);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe('healthy');
      expect(parsed.checks).toBeDefined();
    });

    it('should return error in MCP format when check fails', async () => {
      // Make check() throw an error by making docker ping fail
      mockDockerPing.mockRejectedValue(new Error('Health check failed'));

      const request: CallToolRequest = {
        params: {
          name: 'docker_mcp_health',
          arguments: {},
        },
      } as any;

      const result = await healthTool.handleCall(request);

      // Even if check fails, handleCall should still return valid result (not throw)
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe('unhealthy');
    });
  });
});
