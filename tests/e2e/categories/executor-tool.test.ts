/**
 * E2E Tests for Executor Tool
 * Run: npm run test:e2e:executor
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ExecutorTool } from '../../../src/tools/executor-tool.js';
import { verifyDocker, DOCKER_TIMEOUT } from '../setup.js';

describe('Executor Tool E2E', () => {
  let executorTool: ExecutorTool;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    executorTool = new ExecutorTool();
  }, DOCKER_TIMEOUT);

  it('docker_exec - should execute command in web container', async () => {
    const result = await executorTool.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_exec',
        arguments: {
          service: 'web',
          command: 'echo "Hello from container"'
        }
      }
    });

    expect(result.content[0].text).toContain('Hello from container');
  }, DOCKER_TIMEOUT);

  it('docker_exec - should auto-detect workdir from docker-compose.yml', async () => {
    const result = await executorTool.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_exec',
        arguments: {
          service: 'web',
          command: 'pwd'
        }
      }
    });

    expect(result.content[0].text).toBeTruthy();
    expect(result.isError).toBeFalsy();
  }, DOCKER_TIMEOUT);

  it('docker_exec - should execute node version check', async () => {
    const result = await executorTool.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_exec',
        arguments: {
          service: 'web',
          command: 'node --version'
        }
      }
    });

    expect(result.content[0].text).toMatch(/v\d+\.\d+\.\d+/);
  }, DOCKER_TIMEOUT);
});
