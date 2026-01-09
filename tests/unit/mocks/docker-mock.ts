/**
 * Mock for Dockerode
 * Used in unit tests to isolate from real Docker
 */

import type Docker from 'dockerode';
import { vi } from 'vitest';

/**
 * Mock Container
 */
export interface MockContainer {
  id: string;
  name: string;
  status: 'running' | 'exited' | 'paused' | 'restarting';
  image: string;
  inspectData: any;
  logsData?: Buffer | string;
}

/**
 * Create mock Docker instance
 */
export function createMockDocker(containers: MockContainer[] = []): Docker {
  const mockContainers = new Map<string, MockContainer>();
  const containerInstances = new Map<string, Docker.Container>();
  
  // Convert array to Map for easy lookup
  containers.forEach(container => {
    mockContainers.set(container.id, container);
  });

  const mockDocker = {
    ping: vi.fn().mockResolvedValue(undefined),
    
    listContainers: vi.fn().mockImplementation(async (options?: Docker.ContainerListOptions) => {
      // Convert mock containers to Docker API format
      // Extract project and service from container name: project_service_1
      return containers.map(container => {
        const cleanName = container.name.replace(/^\/+/, '');
        // Parse: project_service_1 or project-service-1
        // Extract project (first part) and service (middle parts before last number)
        const nameParts = cleanName.split('_');
        let projectName = nameParts[0] || 'default';
        let serviceName = 'unknown';
        
        if (nameParts.length >= 3) {
          // Format: project_service_1 or project_service-name_1
          serviceName = nameParts.slice(1, -1).join('_');
        } else if (nameParts.length === 2) {
          // Format: project_service
          serviceName = nameParts[1];
        }
        
        return {
          Id: container.id,
          Names: [container.name.startsWith('/') ? container.name : `/${container.name}`],
          Image: container.image,
          State: container.status,
          Status: `${container.status} 2 hours ago`,
          Created: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
          Ports: [],
          Labels: {
            'com.docker.compose.project': projectName,
            'com.docker.compose.service': serviceName,
            'com.docker.compose.project.working_dir': '/test',
            'com.docker.compose.project.config_files': '/test/docker-compose.yml',
          },
        };
      });
    }),
    
    getContainer: vi.fn().mockImplementation((id: string) => {
      const container = mockContainers.get(id);
      if (!container) {
        throw new Error(`Container ${id} not found`);
      }
      
      // Cache instance to return the same one for the same ID
      if (!containerInstances.has(id)) {
        containerInstances.set(id, createMockContainer(container));
      }
      
      return containerInstances.get(id)!;
    }),
  } as unknown as Docker;

  return mockDocker;
}

/**
 * Create mock Container instance
 */
function createMockContainer(mockContainer: MockContainer): Docker.Container {
  const defaultInspectData = {
    Id: mockContainer.id,
    Name: mockContainer.name,
    State: {
      Status: mockContainer.status,
      Health: mockContainer.inspectData?.State?.Health || null,
    },
    Config: {
      Image: mockContainer.image,
    },
    ...mockContainer.inspectData,
  };

  const mockContainerInstance = {
    id: mockContainer.id,
    
    inspect: vi.fn().mockResolvedValue(defaultInspectData),
    
    start: vi.fn().mockResolvedValue(undefined),
    
    stop: vi.fn().mockResolvedValue(undefined),
    
    restart: vi.fn().mockResolvedValue(undefined),
    
    logs: vi.fn().mockImplementation(async (options?: Docker.ContainerLogsOptions) => {
      const logs = mockContainer.logsData || Buffer.from('test log line\n');
      
      if (options?.follow) {
        // Return mock stream for follow mode
        return new ReadableStream({
          start(controller) {
            controller.enqueue(logs);
            controller.close();
          },
        });
      }
      
      return logs;
    }),
    
    exec: vi.fn().mockImplementation(async (options: Docker.ExecCreateOptions) => {
      return {
        start: vi.fn().mockResolvedValue(
          new ReadableStream({
            start(controller) {
              controller.enqueue(Buffer.from('exec output\n'));
              controller.close();
            },
          })
        ),
      };
    }),
  } as unknown as Docker.Container;

  return mockContainerInstance;
}

/**
 * Helper for creating mock container data
 */
export function createMockContainerData(overrides: Partial<MockContainer> = {}): MockContainer {
  return {
    id: overrides.id || 'test-container-id',
    name: overrides.name || 'test-project_test-service_1',
    status: overrides.status || 'running',
    image: overrides.image || 'test-image:latest',
    inspectData: overrides.inspectData || {
      State: {
        Status: overrides.status || 'running',
        Health: null,
      },
    },
    logsData: overrides.logsData,
    ...overrides,
  };
}

/**
 * Helper for creating mock container with healthcheck
 */
export function createMockContainerWithHealth(
  status: 'healthy' | 'unhealthy' | 'starting',
  checks: number = 5,
  failures: number = 0
): MockContainer {
  return createMockContainerData({
    inspectData: {
      State: {
        Status: 'running',
        Health: {
          Status: status,
          Log: Array(checks).fill(null).map((_, i) => ({
            Start: new Date().toISOString(),
            End: new Date().toISOString(),
            ExitCode: i < failures ? 1 : 0,
            Output: i < failures ? 'health check failed' : 'OK',
          })),
          FailingStreak: failures,
        },
      },
    },
  });
}

