/**
 * E2E Tests for Error Handling
 * Run: npm run test:e2e:errors
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContainerTools } from '../../../src/tools/container-tools.js';
import { DatabaseTools } from '../../../src/tools/database-tools.js';
import { verifyDocker, DOCKER_TIMEOUT } from '../setup.js';

describe('Error Handling E2E', () => {
  let containerTools: ContainerTools;
  let databaseTools: DatabaseTools;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    containerTools = new ContainerTools();
    databaseTools = new DatabaseTools();
  }, DOCKER_TIMEOUT);

  it('should handle non-existent service gracefully', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_logs',
        arguments: { service: 'non-existent-service' }
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  }, DOCKER_TIMEOUT);

  it('should handle invalid SQL query', async () => {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'postgres',
          query: 'INVALID SQL QUERY'
        }
      }
    });

    expect(result.content[0].text).toMatch(/error|Error|ERROR|invalid|Invalid|INVALID/i);
  }, DOCKER_TIMEOUT);

  it('should handle invalid Redis command', async () => {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'redis',
          query: 'INVALID_COMMAND'
        }
      }
    });

    expect(result.content[0].text).toMatch(/error|Error|ERROR|unknown|Unknown|wrong|Wrong/i);
  }, DOCKER_TIMEOUT);
});
