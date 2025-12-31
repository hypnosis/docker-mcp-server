/**
 * Adapter Registry
 * Регистрация и получение Database Adapters по типу БД
 */

import type { DatabaseAdapter } from './database-adapter.js';
import { logger } from '../utils/logger.js';

export class AdapterRegistry {
  private adapters = new Map<string, DatabaseAdapter>();

  /**
   * Регистрировать адаптер
   */
  register(type: string, adapter: DatabaseAdapter): void {
    const normalizedType = type.toLowerCase();
    this.adapters.set(normalizedType, adapter);
    logger.debug(`Registered adapter for: ${type}`);
  }

  /**
   * Получить адаптер по типу
   */
  get(serviceType: string): DatabaseAdapter {
    const type = serviceType.toLowerCase();
    const adapter = this.adapters.get(type);

    if (!adapter) {
      const available = Array.from(this.adapters.keys()).join(', ');
      throw new Error(
        `No adapter found for database type: ${serviceType}\n` +
        `Available adapters: ${available || 'none'}`
      );
    }

    logger.debug(`Using adapter for: ${serviceType}`);
    return adapter;
  }

  /**
   * Проверить наличие адаптера
   */
  has(serviceType: string): boolean {
    return this.adapters.has(serviceType.toLowerCase());
  }

  /**
   * Получить список всех зарегистрированных типов
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Singleton registry
 */
export const adapterRegistry = new AdapterRegistry();

