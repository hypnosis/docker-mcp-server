/**
 * Adapter Registry
 * Registration and retrieval of Database Adapters by database type
 */

import type { DatabaseAdapter } from './database-adapter.js';
import { logger } from '../utils/logger.js';

export class AdapterRegistry {
  private adapters = new Map<string, DatabaseAdapter>();

  /**
   * Register adapter
   */
  register(type: string, adapter: DatabaseAdapter): void {
    const normalizedType = type.toLowerCase();
    this.adapters.set(normalizedType, adapter);
    logger.debug(`Registered adapter for: ${type}`);
  }

  /**
   * Get adapter by type
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
   * Check if adapter exists
   */
  has(serviceType: string): boolean {
    return this.adapters.has(serviceType.toLowerCase());
  }

  /**
   * Get list of all registered types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Singleton registry
 */
export const adapterRegistry = new AdapterRegistry();

