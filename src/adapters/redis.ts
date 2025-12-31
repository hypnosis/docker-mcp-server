/**
 * Redis Adapter
 * Реализация DatabaseAdapter для Redis
 */

import type { DatabaseAdapter } from './database-adapter.js';
import type {
  QueryOptions,
  BackupOptions,
  RestoreOptions,
  DBStatus,
  ConnectionInfo,
} from './types.js';
import type { ServiceConfig } from '../discovery/types.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { EnvManager } from '../managers/env-manager.js';
import { logger } from '../utils/logger.js';

export class RedisAdapter implements DatabaseAdapter {
  private containerManager: ContainerManager;
  private projectDiscovery: ProjectDiscovery;
  private envManager: EnvManager;

  constructor() {
    this.containerManager = new ContainerManager();
    this.projectDiscovery = new ProjectDiscovery();
    this.envManager = new EnvManager();
  }

  /**
   * Выполнить Redis команду
   */
  async query(service: string, query: string, options?: QueryOptions): Promise<string> {
    const project = await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);

    // Строим команду redis-cli
    let cmd = ['redis-cli'];

    // Пароль (если нужен)
    if (conn.password) {
      cmd.push('-a', conn.password);
    }

    // Команда Redis
    const commandParts = query.trim().split(/\s+/);
    cmd.push(...commandParts);

    logger.debug(`Executing Redis command in ${service}: ${query}`);

    const output = await this.containerManager.exec(service, project.name, cmd);

    return output;
  }

  /**
   * Создать backup (RDB snapshot)
   */
  async backup(service: string, options: BackupOptions): Promise<string> {
    const project = await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);

    const output = options.output || `/backups/redis-backup-${Date.now()}.rdb`;

    // 1. Создать snapshot (BGSAVE - фоновый, не блокирует)
    logger.info('Creating Redis snapshot (BGSAVE)...');
    let cmd = ['redis-cli'];
    if (conn.password) {
      cmd.push('-a', conn.password);
    }
    cmd.push('BGSAVE');

    await this.containerManager.exec(service, project.name, cmd);

    // 2. Ждем завершения BGSAVE
    await this.waitForBgsave(service, conn.password);

    // 3. Копируем dump.rdb в output (обычно /data/dump.rdb в контейнере)
    logger.info(`Copying dump.rdb to ${output}...`);
    const copyCmd = ['cp', '/data/dump.rdb', output];
    await this.containerManager.exec(service, project.name, copyCmd);

    return output;
  }

  /**
   * Восстановить из backup
   */
  async restore(
    service: string,
    backupPath: string,
    options?: RestoreOptions
  ): Promise<void> {
    const project = await this.projectDiscovery.findProject();

    logger.info(`Restoring Redis from backup: ${backupPath}`);

    // 1. Остановить контейнер
    logger.info('Stopping Redis container...');
    await this.containerManager.stopContainer(service, project.name);

    // 2. Копировать backup файл в место где Redis его найдет
    logger.info('Copying backup file...');
    const copyCmd = ['cp', backupPath, '/data/dump.rdb'];
    await this.containerManager.exec(service, project.name, copyCmd);

    // 3. Запустить контейнер (Redis автоматически загрузит dump.rdb)
    logger.info('Starting Redis container...');
    await this.containerManager.startContainer(service, project.name);

    logger.info('Redis restore completed');
  }

  /**
   * Получить статус БД
   */
  async status(service: string): Promise<DBStatus> {
    const project = await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);

    // Получаем INFO
    const infoOutput = await this.query(service, 'INFO');
    const info = this.parseRedisInfo(infoOutput);

    return {
      type: 'redis',
      version: info.redis_version || 'unknown',
      status: 'healthy',
      memory: info.used_memory_human || 'unknown',
      uptime: this.formatUptime(parseInt(info.uptime_in_seconds || '0')),
      additional: {
        keys: parseInt(info.db0?.keys || '0'),
        clients: parseInt(info.connected_clients || '0'),
      },
    };
  }

  /**
   * Получить connection info из environment
   */
  getConnectionInfo(service: ServiceConfig, env: Record<string, string>): ConnectionInfo {
    return {
      host: 'localhost',
      port: 6379,
      user: '',
      password: env.REDIS_PASSWORD,
      database: '0',
    };
  }

  /**
   * Ждать завершения BGSAVE
   */
  private async waitForBgsave(service: string, password?: string): Promise<void> {
    const project = await this.projectDiscovery.findProject();
    let attempts = 0;
    const maxAttempts = 30; // 30 секунд максимум

    while (attempts < maxAttempts) {
      let cmd = ['redis-cli'];
      if (password) {
        cmd.push('-a', password);
      }
      cmd.push('LASTSAVE');

      const output = await this.containerManager.exec(service, project.name, cmd);
      const lastsave = parseInt(output.trim());

      // Проверяем что BGSAVE завершен
      cmd = ['redis-cli'];
      if (password) {
        cmd.push('-a', password);
      }
      cmd.push('INFO', 'persistence');

      const persistenceInfo = await this.containerManager.exec(service, project.name, cmd);
      const info = this.parseRedisInfo(persistenceInfo);

      if (info.rdb_bgsave_in_progress === '0') {
        logger.debug('BGSAVE completed');
        return;
      }

      // Ждем 1 секунду перед следующей проверкой
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('BGSAVE timeout: backup did not complete in 30 seconds');
  }

  /**
   * Парсит Redis INFO output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};

    info.split('\n').forEach((line) => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        // Специальная обработка для db0 (keys)
        if (key.startsWith('db0')) {
          if (!result.db0) {
            result.db0 = {};
          }
          const dbKey = key.replace('db0', '').trim();
          if (dbKey) {
            result.db0[dbKey] = value;
          }
        } else {
          result[key.trim()] = value;
        }
      }
    });

    return result;
  }

  /**
   * Форматирует uptime в человекочитаемый формат
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

    return parts.join(' ') || '0 minutes';
  }
}

