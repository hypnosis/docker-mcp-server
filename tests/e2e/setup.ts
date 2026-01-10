/**
 * Shared setup for E2E tests
 */

import { getDockerClient } from '../../src/utils/docker-client.js';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

export const DOCKER_TIMEOUT = 30000;

export async function setupE2E() {
  // Note: Database adapters are no longer registered as singletons
  // They are created per-request with dependency injection in DatabaseTools

  // Verify Docker is running
  const docker = getDockerClient();
  await docker.ping();
  
  // Cleanup: stop and remove any existing test containers to avoid port conflicts
  const composeFile = resolve(process.cwd(), 'docker-compose.test.yml');
  try {
    spawnSync('docker', ['compose', '-f', composeFile, 'down', '--remove-orphans'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch {
    // Ignore
  }
  
  // Start test containers
  try {
    const upResult = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    if (upResult.status === 0 || upResult.status === null) {
      console.log('✓ Test containers started');
    }
  } catch {
    // Ignore - containers might already be running
  }
  
  console.log('✓ Docker is running');
  console.log('✓ Database adapters use DI (no registration needed)');
}
