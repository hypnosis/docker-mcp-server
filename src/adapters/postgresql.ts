/**
 * PostgreSQL Adapter
 * DatabaseAdapter implementation for PostgreSQL
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
   * Execute SQL query
   */
  async query(service: string, query: string, options?: QueryOptions): Promise<string> {
    // SQL validation (if enabled)
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

    // Build psql command
    const format = options?.format || 'table';
    let cmd = ['psql', '-U', user, '-d', db];

    // Output format
    if (format === 'json') {
      cmd.push('--json');
    } else if (format === 'csv') {
      cmd.push('--csv');
    }

    // SQL query
    cmd.push('-c', query);

    // Password via PGPASSWORD env var
    const envVars = conn.password ? [`PGPASSWORD=${conn.password}`] : [];

    logger.debug(`Executing PostgreSQL query in ${service}: ${query}`);

    const output = await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    });

    return output;
  }

  /**
   * Create backup
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

    // Build pg_dump command
    let cmd = ['pg_dump', '-U', conn.user, '-d', conn.database];

    // Backup format
    if (format === 'custom') {
      cmd.push('-Fc'); // Custom format (compressed)
    } else if (format === 'tar') {
      cmd.push('-Ft'); // Tar format
    } else if (format === 'directory') {
      cmd.push('-Fd'); // Directory format
    }
    // 'sql' format - default (plain SQL)

    // Backup specific tables
    if (options.tables && options.tables.length > 0) {
      for (const table of options.tables) {
        cmd.push('-t', table);
      }
    }

    // Output file
    cmd.push('-f', output);

    // Password via PGPASSWORD
    const envVars = conn.password ? [`PGPASSWORD=${conn.password}`] : [];

    logger.info(`Creating PostgreSQL backup: ${output}`);

    await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    });

    return output;
  }

  /**
   * Restore from backup
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

    // Determine backup format by extension
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

    // Password via PGPASSWORD
    const envVars = conn.password ? [`PGPASSWORD=${conn.password}`] : [];

    logger.info(`Restoring PostgreSQL from backup: ${backupPath}`);

    await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    });
  }

  /**
   * Get database status
   */
  async status(service: string): Promise<DBStatus> {
    const project = await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);

    // Get version
    const versionOutput = await this.query(service, 'SELECT version();');
    const version = this.parseVersion(versionOutput);

    // Get database size
    const sizeOutput = await this.query(
      service,
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size;"
    );
    const size = this.parseSingleValue(sizeOutput);

    // Get connection count
    const connectionsOutput = await this.query(
      service,
      "SELECT count(*) as connections FROM pg_stat_activity WHERE datname = current_database();"
    );
    const connections = parseInt(this.parseSingleValue(connectionsOutput) || '0');

    // Get uptime
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
   * Get connection info from environment
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
   * Parse PostgreSQL version from output
   */
  private parseVersion(versionOutput: string): string {
    const match = versionOutput.match(/PostgreSQL\s+(\d+\.\d+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Parse single value from SQL output (first row, first column)
   */
  private parseSingleValue(output: string): string {
    // Simple parsing: take first line after header
    const lines = output.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      return '';
    }
    // Skip header, take first data row
    const dataLine = lines[1];
    // Remove extra spaces
    return dataLine.trim();
  }
}

