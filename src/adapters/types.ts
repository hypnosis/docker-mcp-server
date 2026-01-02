/**
 * Types for Database Adapters
 */

import type { ServiceConfig } from '../discovery/types.js';

/**
 * Options for query
 */
export interface QueryOptions {
  database?: string;
  user?: string;
  format?: 'table' | 'json' | 'csv';
}

/**
 * Options for backup
 */
export interface BackupOptions {
  output?: string;
  format?: 'sql' | 'custom' | 'tar' | 'directory';
  compress?: boolean;
  tables?: string[];
}

/**
 * Options for restore
 */
export interface RestoreOptions {
  database?: string;
  clean?: boolean;
  dataOnly?: boolean;
  schemaOnly?: boolean;
}

/**
 * Database status
 */
export interface DBStatus {
  type: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  size?: string;
  connections?: number;
  uptime?: string;
  memory?: string;
  additional?: Record<string, any>;
}

/**
 * Connection Info for database
 */
export interface ConnectionInfo {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

