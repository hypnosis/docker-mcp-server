/**
 * E2E Tests for Discovery Tools
 * Run: npm run test:e2e:discovery
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DiscoveryTools } from '../../../src/tools/discovery-tools.js';
import { verifyDocker, DOCKER_TIMEOUT } from '../setup.js';

describe('Discovery Tools E2E', () => {
  let discoveryTools: DiscoveryTools;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    discoveryTools = new DiscoveryTools();
  }, DOCKER_TIMEOUT);

  it('docker_projects - should list Docker projects', async () => {
    const result = await discoveryTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_projects',
        arguments: {}
      }
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain('docker-mcp-server');
  }, DOCKER_TIMEOUT);
});
