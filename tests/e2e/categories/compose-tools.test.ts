/**
 * E2E Tests for Compose Commands
 * Run: npm run test:e2e:compose
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ContainerTools } from '../../../src/tools/container-tools.js';
import { verifyDocker, DOCKER_TIMEOUT, restartTestContainers } from '../setup.js';

describe('Compose Commands E2E', () => {
  let containerTools: ContainerTools;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    containerTools = new ContainerTools();
  }, DOCKER_TIMEOUT);

  afterAll(async () => {
    // ВАЖНО: После compose-down перезапускаем тестовые контейнеры для последующих тестов
    // compose-down останавливает контейнеры, и они нужны для других тестов
    await restartTestContainers();
  }, DOCKER_TIMEOUT * 2);

  it('docker_compose_up - should start services', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_compose_up',
        arguments: {
          detach: true
        }
      }
    });

    expect(result.content).toBeDefined();
    expect(result.isError).toBeFalsy();
  }, DOCKER_TIMEOUT);

  it('docker_compose_down - should stop all services and restart', async () => {
    const downResult = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_compose_down',
        arguments: {
          volumes: false,
          removeOrphans: false
        }
      }
    });

    expect(downResult.content).toBeDefined();
    expect(downResult.isError).toBeFalsy();

    // Restart services
    await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_compose_up',
        arguments: {
          detach: true
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const listResult = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_list',
        arguments: {}
      }
    });
    
    expect(listResult.content[0].text).toContain('test-web');
  }, DOCKER_TIMEOUT * 3);
});
