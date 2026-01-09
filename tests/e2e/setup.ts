/**
 * Shared setup for E2E tests
 */

import { getDockerClient } from '../../src/utils/docker-client.js';
import { adapterRegistry } from '../../src/adapters/adapter-registry.js';
import { PostgreSQLAdapter } from '../../src/adapters/postgresql.js';
import { RedisAdapter } from '../../src/adapters/redis.js';

export const DOCKER_TIMEOUT = 30000;

export async function setupE2E() {
  // Register Database Adapters (required for database tests)
  adapterRegistry.register('postgresql', new PostgreSQLAdapter());
  adapterRegistry.register('postgres', new PostgreSQLAdapter());
  adapterRegistry.register('redis', new RedisAdapter());

  // Verify Docker is running
  const docker = getDockerClient();
  await docker.ping();
  
  console.log('✓ Docker is running');
  console.log('✓ Database adapters registered');
}
