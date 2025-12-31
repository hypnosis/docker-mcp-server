/**
 * Database Adapter Interface
 * Интерфейс для работы с разными типами БД
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
 * Интерфейс для Database Adapters
 * Все адаптеры должны реализовать этот интерфейс
 */
export interface DatabaseAdapter {
  /**
   * Выполнить query или команду
   */
  query(
    service: string,
    query: string,
    options?: QueryOptions
  ): Promise<string>;

  /**
   * Создать backup
   */
  backup(service: string, options: BackupOptions): Promise<string>;

  /**
   * Восстановить из backup
   */
  restore(
    service: string,
    backupPath: string,
    options?: RestoreOptions
  ): Promise<void>;

  /**
   * Получить статус БД
   */
  status(service: string): Promise<DBStatus>;

  /**
   * Получить connection info из environment
   */
  getConnectionInfo(
    service: ServiceConfig,
    env: Record<string, string>
  ): ConnectionInfo;
}

