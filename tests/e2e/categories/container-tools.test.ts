/**
 * E2E Tests for Container Tools
 * Run: npm run test:e2e:container
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContainerTools } from '../../../src/tools/container-tools.js';
import { verifyDocker, DOCKER_TIMEOUT } from '../setup.js';

describe('Container Tools E2E', () => {
  let containerTools: ContainerTools;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    containerTools = new ContainerTools();
  }, DOCKER_TIMEOUT);

  it('docker_container_list - should list all containers', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_list',
        arguments: {}
      }
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain('test-web');
    expect(result.content[0].text).toContain('test-postgres');
    expect(result.content[0].text).toContain('test-redis');
  }, DOCKER_TIMEOUT);

  it('docker_container_list - should list containers for specific project', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_list',
        arguments: { project: 'docker-mcp-server' }
      }
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain('test-web');
  }, DOCKER_TIMEOUT);

  it('docker_container_stop - should stop a running container', async () => {
    // Ensure container is running first
    await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_start',
        arguments: { service: 'web', project: 'docker-mcp-server' }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_stop',
        arguments: { service: 'web', project: 'docker-mcp-server' }
      }
    });

    expect(result.content[0].text).toContain('stopped');
    
    // Restart for other tests
    await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_start',
        arguments: { service: 'web', project: 'docker-mcp-server' }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, DOCKER_TIMEOUT);

  it('docker_container_start - should start a stopped container', async () => {
    // Ensure container is stopped first
    await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_stop',
        arguments: { service: 'web', project: 'docker-mcp-server' }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_start',
        arguments: { service: 'web', project: 'docker-mcp-server' }
      }
    });

    // Check for success message (ignore HTTP 304 "already started" errors)
    const text = result.content[0].text;
    expect(text.includes('started') || text.includes('already started')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, DOCKER_TIMEOUT);

  it('docker_container_restart - should restart a container', async () => {
    // Ensure container is running first
    await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_start',
        arguments: { service: 'web', project: 'docker-mcp-server' }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_restart',
        arguments: { service: 'web', project: 'docker-mcp-server' }
      }
    });

    // Check for success message (ignore HTTP 304 "already started" errors)
    const text = result.content[0].text;
    expect(text.includes('restarted') || text.includes('already started')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, DOCKER_TIMEOUT);

  it('docker_container_logs - should get container logs', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_logs',
        arguments: { service: 'web', project: 'docker-mcp-server', lines: 10 }
      }
    });

    expect(result.content).toBeDefined();
    // Logs might be empty for new containers, but content should exist
    expect(result.content[0]).toBeDefined();
    expect(typeof result.content[0].text).toBe('string');
  }, DOCKER_TIMEOUT);

  it('docker_container_stats - should get container stats', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_stats',
        arguments: { 
          service: 'web',
          project: 'docker-mcp-server'
        }
      }
    });

    const stats = JSON.parse(result.content[0].text);
    expect(stats).toHaveProperty('cpuPercent');
    expect(stats).toHaveProperty('memoryUsage');
    // Container name might have project prefix in CI (e.g., "0e96cfe46fa7_test-web")
    expect(stats.name).toContain('test-web');
  }, DOCKER_TIMEOUT);

  it('docker_resource_list - should list Docker images', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_resource_list',
        arguments: { type: 'images' }
      }
    });

    const images = JSON.parse(result.content[0].text);
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toHaveProperty('id');
  }, DOCKER_TIMEOUT);

  it('docker_resource_list - should list Docker volumes', async () => {
    const result = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_resource_list',
        arguments: { type: 'volumes' }
      }
    });

    const volumes = JSON.parse(result.content[0].text);
    expect(Array.isArray(volumes)).toBe(true);
    expect(volumes.length).toBeGreaterThan(0);
    expect(volumes[0]).toHaveProperty('name');
  }, DOCKER_TIMEOUT);
});
