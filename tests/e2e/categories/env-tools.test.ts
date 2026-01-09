/**
 * E2E Tests for Environment Tools
 * Run: npm run test:e2e:env
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { EnvTools } from '../../../src/tools/env-tools.js';
import { setupE2E, DOCKER_TIMEOUT } from '../setup.js';

describe('Environment Tools E2E', () => {
  let envTools: EnvTools;

  beforeAll(async () => {
    await setupE2E();
    envTools = new EnvTools();
  }, DOCKER_TIMEOUT);

  it('docker_env_list - should list environment variables', async () => {
    const result = await envTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_env_list',
        arguments: {}
      }
    });

    expect(result.content[0].text).toContain('Environment Variables');
  }, DOCKER_TIMEOUT);

  it('docker_env_list - should list env for specific service', async () => {
    const result = await envTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_env_list',
        arguments: { service: 'web' }
      }
    });

    expect(result.content[0].text).toContain('NODE_ENV');
    expect(result.content[0].text).toContain('DATABASE_URL');
  }, DOCKER_TIMEOUT);

  it('docker_env_list - should mask secrets', async () => {
    const result = await envTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_env_list',
        arguments: { service: 'web', maskSecrets: true }
      }
    });

    expect(result.content[0].text).toContain('SECRET_KEY');
    expect(result.content[0].text).toMatch(/SECRET_KEY.*\*\*\*MASKED\*\*\*/);
  }, DOCKER_TIMEOUT);

  it('docker_compose_config - should show compose configuration', async () => {
    const result = await envTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_compose_config',
        arguments: {}
      }
    });

    expect(result.content[0].text).toContain('services');
  }, DOCKER_TIMEOUT);

  it('docker_healthcheck - should check health of all services', async () => {
    const result = await envTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_healthcheck',
        arguments: {}
      }
    });

    const health = JSON.parse(result.content[0].text);
    expect(health).toHaveProperty('overall');
    expect(health).toHaveProperty('services');
    expect(Array.isArray(health.services)).toBe(true);
  }, DOCKER_TIMEOUT);
});
