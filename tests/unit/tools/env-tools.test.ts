/**
 * Tests for EnvTools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnvTools } from '../../../src/tools/env-tools.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import type { ProjectConfig } from '../../../src/discovery/types.js';

// Mock dependencies
const mockEnvManager = {
  loadEnv: vi.fn(),
  maskSecrets: vi.fn(),
};

const mockProjectDiscovery = {
  findProject: vi.fn(),
};

const mockContainerManager = {
  listContainers: vi.fn(),
  getHealthStatus: vi.fn(),
};

const mockComposeParser = {
  parseRaw: vi.fn(),
};

const mockComposeExecRun = vi.fn();

vi.mock('../../../src/managers/env-manager.js', () => ({
  EnvManager: class {
    loadEnv = mockEnvManager.loadEnv;
    maskSecrets = mockEnvManager.maskSecrets;
  },
}));

vi.mock('../../../src/discovery/project-discovery.js', () => ({
  ProjectDiscovery: class {
    findProject = mockProjectDiscovery.findProject;
  },
}));

vi.mock('../../../src/managers/container-manager.js', () => ({
  ContainerManager: class {
    listContainers = mockContainerManager.listContainers;
    getHealthStatus = mockContainerManager.getHealthStatus;
  },
}));

vi.mock('../../../src/discovery/compose-parser.js', () => ({
  ComposeParser: class {
    parseRaw = mockComposeParser.parseRaw;
  },
}));

vi.mock('../../../src/utils/compose-exec.js', () => ({
  ComposeExec: {
    run: (...args: any[]) => mockComposeExecRun(...args),
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('EnvTools', () => {
  let envTools: EnvTools;
  let mockProject: ProjectConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockComposeExecRun.mockClear();

    // Setup mock project
    mockProject = {
      name: 'test-project',
      composeFile: '/test/docker-compose.yml',
      projectDir: '/test',
      services: {
        web: {
          name: 'web',
          type: 'generic',
          image: 'node:18',
          environment: {
            NODE_ENV: 'production',
            PORT: '3000',
          },
        },
        db: {
          name: 'db',
          type: 'postgresql',
          image: 'postgres:15',
        },
      },
    };

    // Setup mock implementations
    mockProjectDiscovery.findProject.mockResolvedValue(mockProject);
    
    mockEnvManager.maskSecrets.mockImplementation((env: Record<string, string>) => {
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(env)) {
        masked[key] = key.toUpperCase().includes('PASSWORD') || key.toUpperCase().includes('TOKEN') 
          ? '***MASKED***' 
          : value;
      }
      return masked;
    });

    mockComposeParser.parseRaw.mockReturnValue({
      services: mockProject.services,
    });

    envTools = new EnvTools();
  });

  describe('docker_env_list', () => {
    it('should return env list with masking', async () => {
      const env = {
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_PASSWORD: 'secret123',
      };

      mockEnvManager.loadEnv.mockReturnValue(env);

      const request: CallToolRequest = {
        params: {
          name: 'docker_env_list',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.content[0].text).toContain('Environment Variables:');
      expect(result.content[0].text).toContain('NODE_ENV=production');
      expect(result.content[0].text).toContain('PORT=3000');
      expect(result.content[0].text).toContain('DATABASE_PASSWORD=***MASKED***');
      expect(mockEnvManager.loadEnv).toHaveBeenCalled();
    });

    it('should return env list without masking when maskSecrets=false', async () => {
      const env = {
        NODE_ENV: 'production',
        DATABASE_PASSWORD: 'secret123',
      };

      mockEnvManager.loadEnv.mockReturnValue(env);
      mockEnvManager.maskSecrets.mockClear();

      const request: CallToolRequest = {
        params: {
          name: 'docker_env_list',
          arguments: { maskSecrets: false },
        },
      } as any;

      const result = await envTools.handleCall(request);

      // When maskSecrets=false, maskSecrets should not be called
      expect(mockEnvManager.maskSecrets).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('DATABASE_PASSWORD=secret123');
    });

    it('should return env for specific service', async () => {
      const env = {
        NODE_ENV: 'production',
        PORT: '3000',
      };

      mockEnvManager.loadEnv.mockReturnValue(env);

      const request: CallToolRequest = {
        params: {
          name: 'docker_env_list',
          arguments: { service: 'web' },
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(mockEnvManager.loadEnv).toHaveBeenCalledWith(
        '/test',
        'web',
        mockProject.services.web
      );
      expect(result.content[0].text).toContain('NODE_ENV=production');
    });

    it('should return error when service not found', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'docker_env_list',
          arguments: { service: 'nonexistent' },
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Service 'nonexistent' not found");
    });

    it('should include masked count in summary', async () => {
      const env = {
        DATABASE_PASSWORD: 'secret',
        API_TOKEN: 'token',
        NODE_ENV: 'production',
      };

      mockEnvManager.loadEnv.mockReturnValue(env);

      const request: CallToolRequest = {
        params: {
          name: 'docker_env_list',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.content[0].text).toContain('🔒');
      expect(result.content[0].text).toContain('secret(s) masked');
    });
  });

  describe('docker_compose_config', () => {
    it('should return parsed config as YAML', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'docker_compose_config',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.content[0].text).toContain('services:');
      expect(mockComposeParser.parseRaw).toHaveBeenCalledWith('/test/docker-compose.yml');
    });

    it('should filter by services', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'docker_compose_config',
          arguments: { services: ['web'] },
        },
      } as any;

      const result = await envTools.handleCall(request);

      const output = result.content[0].text;
      expect(output).toContain('web:');
      expect(output).not.toContain('db:');
    });

    it('should return error when service not found in filter', async () => {
      const request: CallToolRequest = {
        params: {
          name: 'docker_compose_config',
          arguments: { services: ['nonexistent'] },
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Service 'nonexistent' not found");
    });

    it('should use ComposeExec when resolve=true', async () => {
      mockComposeExecRun.mockReturnValue('resolved yaml config');

      const request: CallToolRequest = {
        params: {
          name: 'docker_compose_config',
          arguments: { resolve: true },
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.content[0].text).toBe('resolved yaml config');
      expect(mockComposeExecRun).toHaveBeenCalledWith(
        '/test/docker-compose.yml',
        ['config'],
        { cwd: '/test' }
      );
    });
  });

  describe('docker_healthcheck', () => {
    it('should return health status for all services', async () => {
      mockContainerManager.listContainers.mockResolvedValue([
        { service: 'web', id: 'container1' },
        { service: 'db', id: 'container2' },
      ]);

      mockContainerManager.getHealthStatus
        .mockResolvedValueOnce({ status: 'healthy', checks: 5, failures: 0 })
        .mockResolvedValueOnce({ status: 'healthy', checks: 10, failures: 0 });

      const request: CallToolRequest = {
        params: {
          name: 'docker_healthcheck',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.overall).toBe('healthy');
      expect(parsed.services).toHaveLength(2);
      expect(parsed.services[0].name).toBe('web');
      expect(parsed.services[0].status).toBe('healthy');
    });

    it('should filter by services', async () => {
      mockContainerManager.listContainers.mockResolvedValue([
        { service: 'web', id: 'container1' },
        { service: 'db', id: 'container2' },
      ]);

      mockContainerManager.getHealthStatus.mockResolvedValue({
        status: 'healthy',
        checks: 5,
        failures: 0,
      });

      const request: CallToolRequest = {
        params: {
          name: 'docker_healthcheck',
          arguments: { services: ['web'] },
        },
      } as any;

      const result = await envTools.handleCall(request);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.services).toHaveLength(1);
      expect(parsed.services[0].name).toBe('web');
      expect(mockContainerManager.getHealthStatus).toHaveBeenCalledTimes(1);
    });

    it('should calculate overall status as unhealthy', async () => {
      mockContainerManager.listContainers.mockResolvedValue([
        { service: 'web', id: 'container1' },
        { service: 'db', id: 'container2' },
      ]);

      mockContainerManager.getHealthStatus
        .mockResolvedValueOnce({ status: 'healthy', checks: 5, failures: 0 })
        .mockResolvedValueOnce({ status: 'unhealthy', checks: 10, failures: 3 });

      const request: CallToolRequest = {
        params: {
          name: 'docker_healthcheck',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.overall).toBe('unhealthy');
    });

    it('should calculate overall status as degraded', async () => {
      mockContainerManager.listContainers.mockResolvedValue([
        { service: 'web', id: 'container1' },
      ]);

      mockContainerManager.getHealthStatus.mockResolvedValue({
        status: 'starting',
        checks: 2,
        failures: 0,
      });

      const request: CallToolRequest = {
        params: {
          name: 'docker_healthcheck',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.overall).toBe('degraded');
    });

    it('should return error when service not found', async () => {
      mockContainerManager.listContainers.mockResolvedValue([
        { service: 'web', id: 'container1' },
      ]);

      const request: CallToolRequest = {
        params: {
          name: 'docker_healthcheck',
          arguments: { services: ['nonexistent'] },
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Service 'nonexistent' not found");
    });

    it('should handle health status with no healthcheck', async () => {
      mockContainerManager.listContainers.mockResolvedValue([
        { service: 'web', id: 'container1' },
      ]);

      mockContainerManager.getHealthStatus.mockResolvedValue({
        status: 'none',
        checks: 0,
        failures: 0,
      });

      const request: CallToolRequest = {
        params: {
          name: 'docker_healthcheck',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.overall).toBe('healthy'); // 'none' is considered OK
      expect(parsed.services[0].status).toBe('none');
    });
  });

  describe('error handling', () => {
    it('should return error in MCP format', async () => {
      mockProjectDiscovery.findProject.mockRejectedValue(new Error('Project not found'));

      const request: CallToolRequest = {
        params: {
          name: 'docker_env_list',
          arguments: {},
        },
      } as any;

      const result = await envTools.handleCall(request);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Project not found');
    });
  });
});

