/**
 * Database Adapter Interface
 * Interface for working with different database types
 */

import type { ServiceConfig } from '../discovery/types.js';
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
   */
  query(
    service: string,
    query: string,
    options?: QueryOptions
  ): Promise<string>;

  /**
   * Create backup
   */
  backup(service: string, options: BackupOptions): Promise<string>;

  /**
   * Restore from backup
   */
  restore(
    service: string,
    backupPath: string,
    options?: RestoreOptions
  ): Promise<void>;

  /**
   * Get database status
   */
  status(service: string): Promise<DBStatus>;

  /**
   * Get connection info from environment
   */
  getConnectionInfo(
    service: ServiceConfig,
    env: Record<string, string>
  ): ConnectionInfo;
}

