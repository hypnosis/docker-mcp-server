/**
 * Database Adapter Interface
 * Interface for working with different database types
 */

import type { ServiceConfig, ProjectConfig } from '../discovery/types.js';
import type {
  QueryOptions,
  BackupOptions,
  RestoreOptions,
  DBStatus,
  ConnectionInfo,
} from './types.js';

/**
 * Interface for Database Adapters
 * All adapters must implement this interface
 */
export interface DatabaseAdapter {
  /**
   * Execute query or command
   * @param projectConfig - Optional pre-loaded project (for remote mode)
   */
  query(
    service: string,
    query: string,
    options?: QueryOptions,
    projectConfig?: ProjectConfig
  ): Promise<string>;

  /**
   * Create backup
   * @param projectConfig - Optional pre-loaded project (for remote mode)
   */
  backup(service: string, options: BackupOptions, projectConfig?: ProjectConfig): Promise<string>;

  /**
   * Restore from backup
   * @param projectConfig - Optional pre-loaded project (for remote mode)
   */
  restore(
    service: string,
    backupPath: string,
    options?: RestoreOptions,
    projectConfig?: ProjectConfig
  ): Promise<void>;

  /**
   * Get database status
   * @param projectConfig - Optional pre-loaded project (for remote mode)
   */
  status(service: string, projectConfig?: ProjectConfig): Promise<DBStatus>;

  /**
   * Get connection info from environment
   */
  getConnectionInfo(
    service: ServiceConfig,
    env: Record<string, string>
  ): ConnectionInfo;
}

