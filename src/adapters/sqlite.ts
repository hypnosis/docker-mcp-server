/**
 * SQLite Adapter
 * Реализация DatabaseAdapter для SQLite
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
import { sqlValidator } from '../security/sql-validator.js';
import { logger } from '../utils/logger.js';

export class SQLiteAdapter implements DatabaseAdapter {
  private containerManager: ContainerManager;
  private projectDiscovery: ProjectDiscovery;
  private envManager: EnvManager;

  constructor() {
    this.containerManager = new ContainerManager();
    this.projectDiscovery = new ProjectDiscovery();
    this.envManager = new EnvManager();
  }

  /**
   * Выполнить SQL query или мета-команду
   */
  async query(service: string, query: string, options?: QueryOptions): Promise<string> {
    // Валидация SQL (если включена, только для SQL запросов, не для мета-команд)
    if (!query.startsWith('.')) {
      sqlValidator.validate(query);
    }

    const project = await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);
    const dbPath = conn.database;

    // Строим команду sqlite3
    let cmd: string[];

    if (query.startsWith('.')) {
      // Мета-команда (например, .tables, .schema)
      cmd = ['sqlite3', dbPath, query];
    } else {
      // SQL запрос
      cmd = ['sqlite3', dbPath, query];
    }

    logger.debug(`Executing SQLite query in ${service}: ${query}`);

    const output = await this.containerManager.exec(service, project.name, cmd);

    return output;
  }

  /**
   * Создать backup
   */
  async backup(service: string, options: BackupOptions): Promise<string> {
    const project = await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);
    const dbPath = conn.database;

    const output = options.output || `/backups/sqlite-backup-${Date.now()}.db`;

    // Используем .backup команду (безопасно, работает даже если БД используется)
    logger.info(`Creating SQLite backup: ${output}`);
    const cmd = ['sqlite3', dbPath, `.backup ${output}`];

    await this.containerManager.exec(service, project.name, cmd);

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
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);
    const dbPath = conn.database;

    logger.info(`Restoring SQLite from backup: ${backupPath}`);

    // Простое копирование файла (SQLite - это файловая БД)
    const cmd = ['cp', backupPath, dbPath];

    await this.containerManager.exec(service, project.name, cmd);

    logger.info('SQLite restore completed');
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
    const dbPath = conn.database;

    // Получаем версию SQLite
    const versionOutput = await this.query(service, 'SELECT sqlite_version();');
    const version = versionOutput.trim();

    // Получаем количество таблиц
    const tablesOutput = await this.query(
      service,
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
    );
    const tables = parseInt(tablesOutput.trim() || '0');

    return {
      type: 'sqlite',
      version,
      status: 'healthy',
      additional: {
        tables,
        database_path: dbPath,
      },
    };
  }

  /**
   * Получить connection info из environment
   */
  getConnectionInfo(service: ServiceConfig, env: Record<string, string>): ConnectionInfo {
    return {
      host: 'localhost',
      port: 0,
      user: '',
      database: env.SQLITE_DATABASE || '/app/db.sqlite3',
    };
  }
}

