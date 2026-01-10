/**
 * Shared setup for E2E tests
 * Global setup/teardown для имитации CI (GitHub Actions)
 */

import { getDockerClient } from '../../src/utils/docker-client.js';
import { spawnSync, execSync } from 'child_process';
import { resolve } from 'path';

export const DOCKER_TIMEOUT = 30000;
const MAX_WAIT_TIME = 60000; // 60 секунд максимум на ожидание
const HEALTHCHECK_INTERVAL = 2000; // Проверка каждые 2 секунды

let containersStarted = false;

/**
 * Ждём готовности контейнера через healthcheck или простую проверку
 */
async function waitForContainerReady(docker: any, containerName: string): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_TIME) {
    try {
      const containers = await docker.listContainers({ all: true });
      const container = containers.find((c: any) => 
        c.Names.some((name: string) => name.includes(containerName))
      );
      
      if (!container) {
        await new Promise(resolve => setTimeout(resolve, HEALTHCHECK_INTERVAL));
        continue;
      }
      
      // Проверяем healthcheck статус
      if (container.Status && container.Status.includes('healthy')) {
        return true;
      }
      
      // Если контейнер запущен (не exited), считаем готовым
      if (container.State === 'running' && !container.Status.includes('Exited')) {
        // Получаем реальное имя контейнера из Docker API
        const actualContainerName = container.Names[0]?.replace(/^\//, '') || containerName;
        
        // Дополнительная проверка: пытаемся подключиться
        if (containerName.includes('postgres')) {
          try {
            execSync(`docker exec ${actualContainerName} pg_isready -U testuser -d testdb`, {
              stdio: 'pipe',
              timeout: 5000,
            });
            return true;
          } catch {
            // Продолжаем ждать
          }
        } else if (containerName.includes('redis')) {
          try {
            execSync(`docker exec ${actualContainerName} redis-cli ping`, {
              stdio: 'pipe',
              timeout: 5000,
            });
            return true;
          } catch {
            // Продолжаем ждать
          }
        } else {
          // Для web просто проверяем что контейнер запущен
          return true;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, HEALTHCHECK_INTERVAL));
    } catch (error) {
      // Продолжаем ждать
      await new Promise(resolve => setTimeout(resolve, HEALTHCHECK_INTERVAL));
    }
  }
  
  return false;
}

/**
 * Глобальный setup - запускается один раз перед всеми тестами
 */
export async function globalSetupE2E() {
  if (containersStarted) {
    return; // Уже запущены
  }

  console.log('🔧 E2E Setup: Starting test containers (CI mode)...');
  
  // Verify Docker is running
  const docker = getDockerClient();
  try {
    await docker.ping();
    console.log('✓ Docker is running');
  } catch (error) {
    throw new Error('Docker is not running. Please start Docker Desktop.');
  }
  
  // Cleanup: stop and remove any existing test containers to avoid port conflicts
  const composeFile = resolve(process.cwd(), 'docker-compose.test.yml');
  console.log('🔧 Cleaning up existing test containers...');
  
  try {
    spawnSync('docker', ['compose', '-f', composeFile, 'down', '--remove-orphans', '--volumes'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error) {
    // Ignore - containers might not exist
  }
  
  // Start test containers
  console.log('🔧 Starting test containers...');
  const upResult = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  
  if (upResult.status !== 0 && upResult.status !== null) {
    console.error('❌ Failed to start containers:', upResult.stderr?.toString());
    throw new Error('Failed to start test containers');
  }
  
  console.log('✓ Test containers started');
  
  // Ждём готовности контейнеров (для надёжности, даже после --wait)
  console.log('🔧 Waiting for containers to be ready...');
  
  const postgresReady = await waitForContainerReady(docker, 'test-postgres');
  const redisReady = await waitForContainerReady(docker, 'test-redis');
  const webReady = await waitForContainerReady(docker, 'test-web');
  
  if (!postgresReady) console.warn('⚠️  PostgreSQL container not fully ready');
  if (!redisReady) console.warn('⚠️  Redis container not fully ready');
  if (!webReady) console.warn('⚠️  Web container not fully ready');
  
  if (postgresReady && redisReady && webReady) {
    console.log('✓ All containers are ready');
  } else {
    console.log('⚠️  Some containers may not be fully ready, but continuing...');
  }
  
  containersStarted = true;
  console.log('✅ E2E Setup: Complete\n');
}

/**
 * Глобальный teardown - запускается один раз после всех тестов
 */
export async function globalTeardownE2E() {
  if (!containersStarted) {
    return; // Не запускались
  }

  console.log('\n🧹 E2E Teardown: Stopping test containers...');
  
  const composeFile = resolve(process.cwd(), 'docker-compose.test.yml');
  
  try {
    spawnSync('docker', ['compose', '-f', composeFile, 'down', '--remove-orphans'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    console.log('✓ Test containers stopped');
  } catch (error) {
    console.warn('⚠️  Failed to stop containers:', error);
  }
  
  containersStarted = false;
  console.log('✅ E2E Teardown: Complete');
}

/**
 * Простая функция для проверки что Docker работает
 * Используется в beforeAll для быстрой проверки без запуска контейнеров
 */
export async function verifyDocker() {
  const docker = getDockerClient();
  await docker.ping();
}
