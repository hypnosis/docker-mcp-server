/**
 * Config Merger
 * Deep merge для docker-compose конфигов (как docker-compose делает)
 */

import { logger } from '../utils/logger.js';

export class ConfigMerger {
  /**
   * Deep merge нескольких compose конфигов
   * Правила (как docker-compose):
   * - Объекты мержатся рекурсивно
   * - Массивы конкатенируются (для ports, volumes, depends_on)
   * - Примитивы перезаписываются (последний побеждает)
   */
  merge(configs: any[]): any {
    if (configs.length === 0) {
      return {};
    }

    if (configs.length === 1) {
      return configs[0];
    }

    logger.debug(`Merging ${configs.length} compose configs`);

    return configs.reduce((acc, config) => {
      return this.deepMerge(acc, config);
    }, {});
  }

  /**
   * Рекурсивный deep merge
   */
  private deepMerge(target: any, source: any): any {
    // Если source undefined/null → возвращаем target
    if (source === null || source === undefined) {
      return target;
    }

    // Если target undefined/null → возвращаем source
    if (target === null || target === undefined) {
      return source;
    }

    // Массивы → конкатенация (для ports, volumes, depends_on)
    if (Array.isArray(target) && Array.isArray(source)) {
      return [...target, ...source];
    }

    // Если один массив, другой нет → source побеждает
    if (Array.isArray(source) && !Array.isArray(target)) {
      return source;
    }

    // Объекты → рекурсивный merge
    if (typeof target === 'object' && typeof source === 'object' && !Array.isArray(target) && !Array.isArray(source)) {
      const result = { ...target };
      
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          result[key] = this.deepMerge(target[key], source[key]);
        }
      }
      
      return result;
    }

    // Примитивы → перезапись (последний побеждает)
    return source;
  }
}

