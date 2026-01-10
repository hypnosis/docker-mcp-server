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
import type { ServiceConfig, ProjectConfig } from '../discovery/types.js';
import { ContainerManager } from '../managers/container-manager.js';
import { ProjectDiscovery } from '../discovery/project-discovery.js';
import { EnvManager } from '../managers/env-manager.js';
import { sqlValidator } from '../security/sql-validator.js';
import { logger } from '../utils/logger.js';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private containerManager: ContainerManager;
  private projectDiscovery: ProjectDiscovery;
  private envManager: EnvManager;

  /**
   * Constructor with Dependency Injection
   * @param containerManager - ContainerManager instance (with or without SSH config)
   * @param projectDiscovery - ProjectDiscovery instance
   * @param envManager - EnvManager instance
   */
  constructor(
    containerManager: ContainerManager,
    projectDiscovery: ProjectDiscovery,
    envManager: EnvManager
  ) {
    this.containerManager = containerManager;
    this.projectDiscovery = projectDiscovery;
    this.envManager = envManager;
  }

  /**
   * Execute SQL query
   */
  async query(service: string, query: string, options?: QueryOptions, projectConfig?: ProjectConfig): Promise<string> {
    // SQL validation (if enabled)
    sqlValidator.validate(query);

    // ✅ FIX BUG-007: Use provided project or find local project
    const project = projectConfig || await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    // ✅ FIX: Get env from running container first (more reliable), fallback to compose file
    const containerEnv = await this.containerManager.getContainerEnv(service, project.name, project.composeFile, project.projectDir);
    const composeEnv = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const env = containerEnv || composeEnv; // Use container env if available, otherwise compose
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

    // ✅ FIX BUG-007: Pass composeFile and projectDir for remote mode
    const output = await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    }, project.composeFile, project.projectDir);

    return output;
  }

  /**
   * Create backup
   */
  async backup(service: string, options: BackupOptions, projectConfig?: ProjectConfig): Promise<string> {
    // ✅ FIX: Use provided project or find local project
    const project = projectConfig || await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    // ✅ FIX: Get env from running container first (more reliable), fallback to compose file
    const containerEnv = await this.containerManager.getContainerEnv(service, project.name, project.composeFile, project.projectDir);
    const composeEnv = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const env = containerEnv || composeEnv; // Use container env if available, otherwise compose
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

    // ✅ FIX BUG-007: Pass composeFile and projectDir for remote mode
    await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    }, project.composeFile, project.projectDir);

    return output;
  }

  /**
   * Restore from backup
   */
  async restore(
    service: string,
    backupPath: string,
    options?: RestoreOptions,
    projectConfig?: ProjectConfig
  ): Promise<void> {
    // ✅ FIX: Use provided project or find local project
    const project = projectConfig || await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    // ✅ FIX: Get env from running container first (more reliable), fallback to compose file
    const containerEnv = await this.containerManager.getContainerEnv(service, project.name, project.composeFile, project.projectDir);
    const composeEnv = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const env = containerEnv || composeEnv; // Use container env if available, otherwise compose
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

    // ✅ FIX BUG-007: Pass composeFile and projectDir for remote mode
    await this.containerManager.exec(service, project.name, cmd, {
      env: envVars,
    }, project.composeFile, project.projectDir);
  }

  /**
   * Get database status
   */
  async status(service: string, projectConfig?: ProjectConfig): Promise<DBStatus> {
    // ✅ FIX BUG-007: Use provided project or find local project
    const project = projectConfig || await this.projectDiscovery.findProject();
    const serviceConfig = project.services[service];
    if (!serviceConfig) {
      throw new Error(`Service '${service}' not found in project`);
    }

    // ✅ FIX: Get env from running container first (more reliable), fallback to compose file
    const containerEnv = await this.containerManager.getContainerEnv(service, project.name, project.composeFile, project.projectDir);
    const composeEnv = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const env = containerEnv || composeEnv; // Use container env if available, otherwise compose
    const conn = this.getConnectionInfo(serviceConfig, env);

    // Get version - pass projectConfig to query
    const versionOutput = await this.query(service, 'SELECT version();', undefined, projectConfig);
    const version = this.parseVersion(versionOutput);

    // Get database size
    const sizeOutput = await this.query(
      service,
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size;",
      undefined,
      projectConfig
    );
    const size = this.parseSingleValue(sizeOutput);

    // Get connection count
    const connectionsOutput = await this.query(
      service,
      "SELECT count(*) as connections FROM pg_stat_activity WHERE datname = current_database();",
      undefined,
      projectConfig
    );
    const connections = parseInt(this.parseSingleValue(connectionsOutput) || '0');

    // Get uptime
    const uptimeOutput = await this.query(
      service,
      "SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime;",
      undefined,
      projectConfig
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
    logger.debug(`Parsing single value from ${output.length} chars output`);
    
    const lines = output.split('\n').filter((line) => line.trim().length > 0);
    
    if (lines.length < 2) {
      logger.warn('Not enough lines in SQL output');
      return '';
    }
    
    // psql table format:
    // Line 0: column header (e.g., " size ")
    // Line 1: separator (e.g., "-------")
    // Line 2: actual data (e.g., " 11 MB")
    // Line 3: row count (e.g., "(1 row)")
    
    // Skip header and separator, take data row
    const dataLine = lines.length >= 3 ? lines[2] : lines[1];
    const value = dataLine.trim();
    
    logger.debug(`Parsed value: "${value}"`);
    return value;
  }
}

