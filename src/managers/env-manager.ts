/**
 * Environment Manager
 * Централизованное управление environment variables
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseDotenv } from 'dotenv';
import { logger } from '../utils/logger.js';
import type { ServiceConfig } from '../discovery/types.js';

export class EnvManager {
  /**
   * Загрузить environment variables из всех источников
   * Приоритет: .env.local > .env.{NODE_ENV} > .env > compose environment
   */
  loadEnv(projectDir: string, serviceName?: string, serviceConfig?: ServiceConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // 1. Загрузить .env файлы (в порядке приоритета)
    const envFiles = this.getEnvFiles(projectDir);

    for (const file of envFiles) {
      if (existsSync(file)) {
        const parsed = this.parseEnvFile(file);
        Object.assign(env, parsed);
        logger.debug(`Loaded env from: ${file}`);
      }
    }

    // 2. Если serviceName и serviceConfig указаны → загрузить из compose
    if (serviceName && serviceConfig?.environment) {
      Object.assign(env, serviceConfig.environment);
      logger.debug(`Loaded env from compose for service: ${serviceName}`);
    }

    return env;
  }

  /**
   * Получить список .env файлов (в порядке приоритета)
   * Приоритет: .env.local (highest) > .env.{NODE_ENV} > .env (base)
   */
  private getEnvFiles(projectDir: string): string[] {
    const nodeEnv = process.env.NODE_ENV || 'development';

    return [
      join(projectDir, '.env'),                    // Base (lowest priority)
      join(projectDir, `.env.${nodeEnv}`),         // Environment-specific
      join(projectDir, '.env.local'),              // Local (highest priority)
    ];
  }

  /**
   * Парсит .env файл
   */
  private parseEnvFile(filePath: string): Record<string, string> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return parseDotenv(content);
    } catch (error: any) {
      logger.warn(`Failed to parse env file ${filePath}:`, error.message);
      return {};
    }
  }

  /**
   * Маскировать секреты в environment variables
   */
  maskSecrets(env: Record<string, string>): Record<string, string> {
    const SECRET_KEYWORDS = [
      'PASSWORD',
      'TOKEN',
      'KEY',
      'SECRET',
      'API_KEY',
      'PRIVATE',
      'CREDENTIALS',
    ];

    const masked: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      const isSecret = SECRET_KEYWORDS.some((keyword) =>
        key.toUpperCase().includes(keyword)
      );

      masked[key] = isSecret ? '***MASKED***' : value;
    }

    return masked;
  }

  /**
   * Получить connection info для БД из environment
   * Используется Database Adapters
   */
  getConnectionInfo(
    serviceConfig: ServiceConfig,
    env: Record<string, string>
  ): {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
  } {
    // Базовые значения
    const host = 'localhost';
    const port = 0;
    const user = '';
    const password = undefined;
    const database = '';

    // Тип БД определяет какие переменные искать
    switch (serviceConfig.type) {
      case 'postgresql':
        return {
          host,
          port: 5432,
          user: env.POSTGRES_USER || 'postgres',
          password: env.POSTGRES_PASSWORD,
          database: env.POSTGRES_DB || 'postgres',
        };

      case 'redis':
        return {
          host,
          port: 6379,
          user: '',
          password: env.REDIS_PASSWORD,
          database: '0',
        };

      case 'sqlite':
        return {
          host: 'localhost',
          port: 0,
          user: '',
          database: env.SQLITE_DATABASE || '/app/db.sqlite3',
        };

      default:
        return {
          host,
          port,
          user,
          password,
          database,
        };
    }
  }
}

