/**
 * SQLite Adapter
 * DatabaseAdapter implementation for SQLite
 * Note: sqlite.ts not .js for consistency with other adapters
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

export class SQLiteAdapter implements DatabaseAdapter {
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
   * Execute SQL query or meta-command
   */
  async query(service: string, query: string, options?: QueryOptions): Promise<string> {
    // SQL validation (if enabled, only for SQL queries, not for meta-commands)
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

    // Build sqlite3 command
    let cmd: string[];

    if (query.startsWith('.')) {
      // Meta-command (e.g., .tables, .schema)
      cmd = ['sqlite3', dbPath, query];
    } else {
      // SQL query
      cmd = ['sqlite3', dbPath, query];
    }

    logger.debug(`Executing SQLite query in ${service}: ${query}`);

    const output = await this.containerManager.exec(service, project.name, cmd);

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

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);
    const dbPath = conn.database;

    const output = options.output || `/backups/sqlite-backup-${Date.now()}.db`;

    // Use .backup command (safe, works even if database is in use)
    logger.info(`Creating SQLite backup: ${output}`);
    const cmd = ['sqlite3', dbPath, `.backup ${output}`];

    await this.containerManager.exec(service, project.name, cmd);

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

    const env = this.envManager.loadEnv(project.projectDir, service, serviceConfig);
    const conn = this.getConnectionInfo(serviceConfig, env);
    const dbPath = conn.database;

    logger.info(`Restoring SQLite from backup: ${backupPath}`);

    // Simple file copy (SQLite is a file-based database)
    const cmd = ['cp', backupPath, dbPath];

    await this.containerManager.exec(service, project.name, cmd);

    logger.info('SQLite restore completed');
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
    const dbPath = conn.database;

    // Get SQLite version
    const versionOutput = await this.query(service, 'SELECT sqlite_version();');
    const version = versionOutput.trim();

    // Get table count
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
   * Get connection info from environment
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

