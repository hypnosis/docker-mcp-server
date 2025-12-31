/**
 * PostgreSQL Adapter
 * Реализация DatabaseAdapter для PostgreSQL
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

export class PostgreSQLAdapter implements DatabaseAdapter {
  private containerManager: ContainerManager;
  private projectDiscovery: ProjectDiscovery;
  private envManager: EnvManager;

  constructor() {
    this.containerManager = new ContainerManager();
    this.projectDiscovery = new ProjectDiscovery();
    this.envManager = new EnvManager();
  }

  /**
   * Выполнить SQL query
   */
  async query(service: string, query: string, options?: QueryOptions): Promise<string> {
    // Валидация SQL (если включена)
    sqlValidator.validate(query);

    const project = await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);

    const db = options?.database || conn.database;
    const user = options?.user || conn.user;

    // Строим команду psql
    const format = options?.format || 'table';
    let cmd = ['psql', '-U', user, '-d', db];

    // Формат вывода
    if (format === 'json') {
      cmd.push('--json');
    } else if (format === 'csv') {
      cmd.push('--csv');
    }

    // SQL query
    cmd.push('-c', query);

    // Пароль через PGPASSWORD env var
    const envVars = conn.password ? [`PGPASSWORD=${conn.password}`] : [];

    logger.debug(`Executing PostgreSQL query in ${service}: ${query}`);

    const output = await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    });

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

    const format = options.format || 'custom';
    const output = options.output || `/backups/postgres-backup-${Date.now()}.dump`;

    // Строим команду pg_dump
    let cmd = ['pg_dump', '-U', conn.user, '-d', conn.database];

    // Формат backup
    if (format === 'custom') {
      cmd.push('-Fc'); // Custom format (compressed)
    } else if (format === 'tar') {
      cmd.push('-Ft'); // Tar format
    } else if (format === 'directory') {
      cmd.push('-Fd'); // Directory format
    }
    // 'sql' format - по умолчанию (plain SQL)

    // Backup конкретных таблиц
    if (options.tables && options.tables.length > 0) {
      for (const table of options.tables) {
        cmd.push('-t', table);
      }
    }

    // Output file
    cmd.push('-f', output);

    // Пароль через PGPASSWORD
    const envVars = conn.password ? [`PGPASSWORD=${conn.password}`] : [];

    logger.info(`Creating PostgreSQL backup: ${output}`);

    await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    });

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

    const db = options?.database || conn.database;

    // Определяем формат backup по расширению
    const isCustomFormat = backupPath.endsWith('.dump') || backupPath.endsWith('.backup');

    let cmd: string[];
    if (isCustomFormat) {
      // Custom format → pg_restore
      cmd = ['pg_restore', '-U', conn.user, '-d', db];

      if (options?.clean) {
        cmd.push('--clean');
      }
      if (options?.dataOnly) {
        cmd.push('--data-only');
      }
      if (options?.schemaOnly) {
        cmd.push('--schema-only');
      }

      cmd.push(backupPath);
    } else {
      // SQL format → psql
      cmd = ['psql', '-U', conn.user, '-d', db, '-f', backupPath];
    }

    // Пароль через PGPASSWORD
    const envVars = conn.password ? [`PGPASSWORD=${conn.password}`] : [];

    logger.info(`Restoring PostgreSQL from backup: ${backupPath}`);

    await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    });
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

    // Получаем версию
    const versionOutput = await this.query(service, 'SELECT version();');
    const version = this.parseVersion(versionOutput);

    // Получаем размер БД
    const sizeOutput = await this.query(
      service,
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size;"
    );
    const size = this.parseSingleValue(sizeOutput);

    // Получаем количество подключений
    const connectionsOutput = await this.query(
      service,
      "SELECT count(*) as connections FROM pg_stat_activity WHERE datname = current_database();"
    );
    const connections = parseInt(this.parseSingleValue(connectionsOutput) || '0');

    // Получаем uptime
    const uptimeOutput = await this.query(
      service,
      "SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime;"
    );
    const uptime = this.parseSingleValue(uptimeOutput);

    return {
      type: 'postgresql',
      version,
      status: 'healthy',
      size,
      connections,
      uptime,
    };
  }

  /**
   * Получить connection info из environment
   */
  getConnectionInfo(service: ServiceConfig, env: Record<string, string>): ConnectionInfo {
    return {
      host: 'localhost',
      port: 5432,
      user: env.POSTGRES_USER || 'postgres',
      password: env.POSTGRES_PASSWORD,
      database: env.POSTGRES_DB || 'postgres',
    };
  }

  /**
   * Парсит версию PostgreSQL из output
   */
  private parseVersion(versionOutput: string): string {
    const match = versionOutput.match(/PostgreSQL\s+(\d+\.\d+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Парсит одно значение из SQL output (первая строка, первый столбец)
   */
  private parseSingleValue(output: string): string {
    // Простой парсинг: берем первую строку после заголовка
    const lines = output.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      return '';
    }
    // Пропускаем заголовок, берем первую строку данных
    const dataLine = lines[1];
    // Убираем лишние пробелы
    return dataLine.trim();
  }
}

