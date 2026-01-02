/**
 * Port Utilities
 * Утилиты для работы с портами Docker контейнеров
 */

import { getDockerClient } from './docker-client.js';
import { logger } from './logger.js';

export interface PortConflict {
  port: number;
  containerId: string;
  containerName: string;
  status: string;
}

/**
 * Находит контейнер, который занимает указанный порт
 */
export async function findContainerByPort(port: number): Promise<PortConflict | null> {
  const docker = getDockerClient().getClient();
  
  try {
    // Получаем все контейнеры (включая остановленные)
    const containers = await docker.listContainers({ all: true });
    
    for (const containerInfo of containers) {
      // Проверяем порты контейнера
      if (containerInfo.Ports) {
        for (const portInfo of containerInfo.Ports) {
          // Проверяем published порт (0.0.0.0:5432 -> 5432/tcp)
          if (portInfo.PublicPort === port) {
            const containerId = containerInfo.Id;
            const containerName = containerInfo.Names[0]?.replace(/^\//, '') || containerId.substring(0, 12);
            const status = containerInfo.Status || 'unknown';
            
            logger.info(`Found container using port ${port}: ${containerName} (${containerId.substring(0, 12)})`);
            
            return {
              port,
              containerId,
              containerName,
              status,
            };
          }
        }
      }
    }
    
    return null;
  } catch (error: any) {
    logger.error(`Failed to find container by port ${port}:`, error);
    return null;
  }
}

/**
 * Извлекает номер порта из ошибки Docker
 * Пример: "Bind for 0.0.0.0:5432 failed: port is already allocated" -> 5432
 */
export function extractPortFromError(errorMessage: string): number | null {
  // Паттерн: "Bind for 0.0.0.0:5432 failed" или "port 5432 is already allocated"
  const patterns = [
    /Bind for [\d.]+:(\d+)/i,  // "Bind for 0.0.0.0:5432"
    /port (\d+) is already allocated/i,  // "port 5432 is already allocated"
    /port (\d+) is already in use/i,  // "port 5432 is already in use"
    /:(\d+) failed/i,  // ":5432 failed" (fallback)
  ];
  
  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      const port = parseInt(match[1], 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        logger.debug(`Extracted port ${port} using pattern: ${pattern}`);
        return port;
      }
    }
  }
  
  logger.debug('No port found in error message');
  return null;
}

/**
 * Останавливает контейнер по ID
 */
export async function stopContainerById(containerId: string): Promise<void> {
  const docker = getDockerClient().getClient();
  
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    
    if (info.State.Running) {
      logger.info(`Stopping container ${containerId.substring(0, 12)}...`);
      await container.stop();
      logger.info(`Container ${containerId.substring(0, 12)} stopped successfully`);
    } else {
      logger.debug(`Container ${containerId.substring(0, 12)} is not running`);
    }
  } catch (error: any) {
    logger.error(`Failed to stop container ${containerId}:`, error);
    throw new Error(`Failed to stop container: ${error.message}`);
  }
}

