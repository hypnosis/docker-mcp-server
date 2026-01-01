/**
 * Mock для Dockerode
 * Используется в unit тестах для изоляции от реального Docker
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
 * Создать mock Docker instance
 */
export function createMockDocker(containers: MockContainer[] = []): Docker {
  const mockContainers = new Map<string, MockContainer>();
  const containerInstances = new Map<string, Docker.Container>();
  
  // Преобразуем массив в Map для удобного поиска
  containers.forEach(container => {
    mockContainers.set(container.id, container);
  });

  const mockDocker = {
    ping: vi.fn().mockResolvedValue(undefined),
    
    listContainers: vi.fn().mockImplementation(async (options?: Docker.ContainerListOptions) => {
      // Преобразуем mock containers в формат Docker API
      return containers.map(container => ({
        Id: container.id,
        Names: [container.name.startsWith('/') ? container.name : `/${container.name}`],
        Image: container.image,
        State: container.status,
        Status: `${container.status} 2 hours ago`,
        Created: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        Ports: [],
      }));
    }),
    
    getContainer: vi.fn().mockImplementation((id: string) => {
      const container = mockContainers.get(id);
      if (!container) {
        throw new Error(`Container ${id} not found`);
      }
      
      // Кешируем instance чтобы возвращать один и тот же для одного ID
      if (!containerInstances.has(id)) {
        containerInstances.set(id, createMockContainer(container));
      }
      
      return containerInstances.get(id)!;
    }),
  } as unknown as Docker;

  return mockDocker;
}

/**
 * Создать mock Container instance
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
        // Возвращаем mock stream для follow mode
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
 * Helper для создания mock container данных
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
 * Helper для создания mock container с healthcheck
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

