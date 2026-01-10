/**
 * Tests for ContainerManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContainerManager } from '../../../src/managers/container-manager.js';
import { getDockerClient } from '../../../src/utils/docker-client.js';
import { createMockDocker, createMockContainerData, createMockContainerWithHealth } from '../mocks/docker-mock.js';
import type Docker from 'dockerode';

// Mock docker-client
vi.mock('../../../src/utils/docker-client.js', () => ({
  getDockerClient: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('ContainerManager', () => {
  let manager: ContainerManager;
  let mockDocker: Docker;

  beforeEach(() => {
    mockDocker = createMockDocker([]);
    
    // Mock getDockerClient to return mock docker client
    vi.mocked(getDockerClient).mockReturnValue({
      getClient: () => mockDocker,
      ping: vi.fn().mockResolvedValue(undefined),
      listContainers: vi.fn().mockResolvedValue([]),
      getContainer: vi.fn(),
    } as any);

    manager = new ContainerManager();
    vi.clearAllMocks();
  });

  describe('listContainers', () => {
    it('should list containers for project', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
          status: 'running',
          image: 'node:18',
        }),
        createMockContainerData({
          id: 'container2',
          name: 'my-project_db_1',
          status: 'running',
          image: 'postgres:15',
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const result = await manager.listContainers('my-project');

      expect(result).toHaveLength(2);
      expect(result[0].service).toBe('web');
      expect(result[1].service).toBe('db');
      expect(result[0].image).toBe('node:18');
      expect(result[1].image).toBe('postgres:15');
    });

    it('should return empty array when no containers found', async () => {
      mockDocker = createMockDocker([]);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const result = await manager.listContainers('my-project');

      expect(result).toEqual([]);
    });

    it('should extract service name correctly', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
        }),
        createMockContainerData({
          id: 'container2',
          name: 'my-project_api-service_1',
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const result = await manager.listContainers('my-project');

      expect(result).toHaveLength(2);
      expect(result[0].service).toBe('web');
      expect(result[1].service).toBe('api-service');
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      const containers = [
        createMockContainerWithHealth('healthy', 5, 0),
      ];
      containers[0].id = 'container1';
      containers[0].name = 'my-project_web_1';

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const result = await manager.getHealthStatus('web', 'my-project');

      expect(result.status).toBe('healthy');
      expect(result.checks).toBe(5);
      expect(result.failures).toBe(0);
    });

    it('should return unhealthy status', async () => {
      const containers = [
        createMockContainerWithHealth('unhealthy', 10, 3),
      ];
      containers[0].id = 'container1';
      containers[0].name = 'my-project_web_1';

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const result = await manager.getHealthStatus('web', 'my-project');

      expect(result.status).toBe('unhealthy');
      expect(result.checks).toBe(10);
      expect(result.failures).toBe(3);
    });

    it('should return "none" when healthcheck is not defined', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
          status: 'running',
          inspectData: {
            State: {
              Status: 'running',
              Health: null,
            },
          },
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const result = await manager.getHealthStatus('web', 'my-project');

      expect(result.status).toBe('none');
      expect(result.checks).toBe(0);
      expect(result.failures).toBe(0);
    });

    it('should return "not_running" when container is not running', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
          status: 'exited',
          inspectData: {
            State: {
              Status: 'exited',
              Health: null,
            },
          },
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const result = await manager.getHealthStatus('web', 'my-project');

      expect(result.status).toBe('not_running');
      expect(result.checks).toBe(0);
      expect(result.failures).toBe(0);
    });

    it('should throw error when container not found', async () => {
      mockDocker = createMockDocker([]);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      await expect(manager.getHealthStatus('nonexistent', 'my-project')).rejects.toThrow();
    });
  });

  describe('startContainer', () => {
    it('should start container', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
          status: 'exited',
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      // Get the mock container instance before calling startContainer
      const container = mockDocker.getContainer('container1');
      const startMock = container.start as ReturnType<typeof vi.fn>;

      await manager.startContainer('web', 'my-project');

      expect(startMock).toHaveBeenCalled();
    });

    it('should throw error when container not found', async () => {
      mockDocker = createMockDocker([]);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      await expect(manager.startContainer('nonexistent', 'my-project')).rejects.toThrow();
    });
  });

  describe('stopContainer', () => {
    it('should stop container with default timeout', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
          status: 'running',
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      // Get container before calling stopContainer to access the mock
      const container = mockDocker.getContainer('container1');
      const stopMock = container.stop as ReturnType<typeof vi.fn>;

      await manager.stopContainer('web', 'my-project');

      expect(stopMock).toHaveBeenCalledWith({ t: 10 });
    });

    it('should stop container with custom timeout', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
          status: 'running',
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const container = mockDocker.getContainer('container1');
      const stopMock = container.stop as ReturnType<typeof vi.fn>;

      await manager.stopContainer('web', 'my-project', 30);

      expect(stopMock).toHaveBeenCalledWith({ t: 30 });
    });
  });

  describe('restartContainer', () => {
    it('should restart container', async () => {
      const containers = [
        createMockContainerData({
          id: 'container1',
          name: 'my-project_web_1',
          status: 'running',
        }),
      ];

      mockDocker = createMockDocker(containers);
      vi.mocked(getDockerClient).mockReturnValue({
        getClient: () => mockDocker,
        ping: vi.fn().mockResolvedValue(undefined),
        listContainers: vi.fn().mockImplementation(async () => {
          return await mockDocker.listContainers({ all: true });
        }),
        getContainer: vi.fn(),
      } as any);

      manager = new ContainerManager();

      const container = mockDocker.getContainer('container1');
      const restartMock = container.restart as ReturnType<typeof vi.fn>;

      await manager.restartContainer('web', 'my-project');

      expect(restartMock).toHaveBeenCalledWith({ t: 10 });
    });
  });
});

