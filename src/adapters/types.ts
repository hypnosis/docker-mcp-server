/**
 * Types для Database Adapters
 */

import type { ServiceConfig } from '../discovery/types.js';

/**
 * Опции для query
 */
export interface QueryOptions {
  database?: string;
  user?: string;
  format?: 'table' | 'json' | 'csv';
}

/**
 * Опции для backup
 */
export interface BackupOptions {
  output?: string;
  format?: 'sql' | 'custom' | 'tar' | 'directory';
  compress?: boolean;
  tables?: string[];
}

/**
 * Опции для restore
 */
export interface RestoreOptions {
  database?: string;
  clean?: boolean;
  dataOnly?: boolean;
  schemaOnly?: boolean;
}

/**
 * Статус БД
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
 * Connection Info для БД
 */
export interface ConnectionInfo {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

