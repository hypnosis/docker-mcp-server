/**
 * E2E Tests for Profile Parameter
 * Run: npm run test:e2e:profile
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContainerTools } from '../../../src/tools/container-tools.js';
import { setupE2E, DOCKER_TIMEOUT } from '../setup.js';

describe('Profile Parameter E2E', () => {
  let containerTools: ContainerTools;

  beforeAll(async () => {
    await setupE2E();
    containerTools = new ContainerTools();
  }, DOCKER_TIMEOUT);

  it('should work with default local profile', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_list',
        arguments: {}
      }
    });

    expect(result.content).toBeDefined();
  }, DOCKER_TIMEOUT);

  it('should work with explicit local profile', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_list',
        arguments: { profile: 'local' }
      }
    });

    expect(result.content).toBeDefined();
  }, DOCKER_TIMEOUT);
});
