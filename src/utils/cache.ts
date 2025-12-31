/**
 * Cache utility
 * Кеширование с TTL (Time To Live)
 */

import type { ProjectConfig } from '../discovery/types.js';
import { logger } from './logger.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Generic cache с TTL
 */
export class Cache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number; // milliseconds

  constructor(ttlSeconds: number = 60) {
    this.ttl = ttlSeconds * 1000;
  }

  /**
   * Установить значение в кеш
   */
  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
    logger.debug(`Cache set: ${key} (TTL: ${this.ttl / 1000}s)`);
  }

  /**
   * Получить значение из кеша
   * Возвращает undefined если ключ не найден или истек TTL
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug(`Cache miss: ${key}`);
      return undefined;
    }

    // Проверка TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache expired: ${key}`);
      return undefined;
    }

    logger.debug(`Cache hit: ${key}`);
    return entry.value;
  }

  /**
   * Инвалидировать ключ
   */
  invalidate(key: string): void {
    if (this.cache.delete(key)) {
      logger.debug(`Cache invalidated: ${key}`);
    }
  }

  /**
   * Очистить весь кеш
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`Cache cleared (${size} entries)`);
  }

  /**
   * Проверить наличие ключа (без проверки TTL)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Получить размер кеша
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Singleton для ProjectConfig кеша (TTL: 60 секунд)
 */
export const projectConfigCache = new Cache<ProjectConfig>(60);

