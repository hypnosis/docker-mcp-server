/**
 * Tests for EnvManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvManager } from '../../../src/managers/env-manager.js';
import type { ServiceConfig } from '../../../src/discovery/types.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Mock logger to avoid console output in tests
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('EnvManager', () => {
  let envManager: EnvManager;
  let tempDir: string;

  beforeEach(() => {
    envManager = new EnvManager();
    tempDir = mkdtempSync(join(tmpdir(), 'env-manager-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('maskSecrets', () => {
    it('should mask secrets with keywords', () => {
      const env = {
        DATABASE_PASSWORD: 'secret123',
        API_TOKEN: 'token456',
        JWT_SECRET: 'jwt789',
        API_KEY: 'key123',
        PRIVATE_KEY: 'private456',
        CREDENTIALS: 'creds789',
      };

      const result = envManager.maskSecrets(env);

      expect(result.DATABASE_PASSWORD).toBe('***MASKED***');
      expect(result.API_TOKEN).toBe('***MASKED***');
      expect(result.JWT_SECRET).toBe('***MASKED***');
      expect(result.API_KEY).toBe('***MASKED***');
      expect(result.PRIVATE_KEY).toBe('***MASKED***');
      expect(result.CREDENTIALS).toBe('***MASKED***');
    });

    it('should not mask non-secret variables', () => {
      const env = {
        NODE_ENV: 'production',
        PORT: '3000',
        DEBUG: 'true',
        DATABASE_HOST: 'localhost',
      };

      const result = envManager.maskSecrets(env);

      expect(result.NODE_ENV).toBe('production');
      expect(result.PORT).toBe('3000');
      expect(result.DEBUG).toBe('true');
      expect(result.DATABASE_HOST).toBe('localhost');
    });

    it('should handle case-insensitive keywords', () => {
      const env = {
        password: 'secret',
        TOKEN: 'token',
        Secret: 'secret',
        api_key: 'key',
      };

      const result = envManager.maskSecrets(env);

      expect(result.password).toBe('***MASKED***');
      expect(result.TOKEN).toBe('***MASKED***');
      expect(result.Secret).toBe('***MASKED***');
      expect(result.api_key).toBe('***MASKED***');
    });

    it('should handle empty object', () => {
      const result = envManager.maskSecrets({});
      expect(result).toEqual({});
    });

    it('should handle partial keyword matches', () => {
      const env = {
        DB_PASSWORD: 'secret',
        ACCESS_TOKEN: 'token',
        SECRET_KEY: 'key',
      };

      const result = envManager.maskSecrets(env);

      expect(result.DB_PASSWORD).toBe('***MASKED***');
      expect(result.ACCESS_TOKEN).toBe('***MASKED***');
      expect(result.SECRET_KEY).toBe('***MASKED***');
    });
  });

  describe('getConnectionInfo', () => {
    it('should return PostgreSQL connection info', () => {
      const serviceConfig: ServiceConfig = {
        name: 'postgres',
        type: 'postgresql',
        image: 'postgres:15',
      };

      const env = {
        POSTGRES_USER: 'testuser',
        POSTGRES_PASSWORD: 'testpass',
        POSTGRES_DB: 'testdb',
      };

      const result = envManager.getConnectionInfo(serviceConfig, env);

      expect(result).toEqual({
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
      });
    });

    it('should use defaults for PostgreSQL when env vars are missing', () => {
      const serviceConfig: ServiceConfig = {
        name: 'postgres',
        type: 'postgresql',
        image: 'postgres:15',
      };

      const result = envManager.getConnectionInfo(serviceConfig, {});

      expect(result).toEqual({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: undefined,
        database: 'postgres',
      });
    });

    it('should return Redis connection info', () => {
      const serviceConfig: ServiceConfig = {
        name: 'redis',
        type: 'redis',
        image: 'redis:7',
      };

      const env = {
        REDIS_PASSWORD: 'redispass',
      };

      const result = envManager.getConnectionInfo(serviceConfig, env);

      expect(result).toEqual({
        host: 'localhost',
        port: 6379,
        user: '',
        password: 'redispass',
        database: '0',
      });
    });

    it('should return SQLite connection info', () => {
      const serviceConfig: ServiceConfig = {
        name: 'sqlite',
        type: 'sqlite',
        image: 'sqlite:latest',
      };

      const env = {
        SQLITE_DATABASE: '/data/app.db',
      };

      const result = envManager.getConnectionInfo(serviceConfig, env);

      expect(result).toEqual({
        host: 'localhost',
        port: 0,
        user: '',
        database: '/data/app.db',
      });
    });

    it('should use default for SQLite when env var is missing', () => {
      const serviceConfig: ServiceConfig = {
        name: 'sqlite',
        type: 'sqlite',
        image: 'sqlite:latest',
      };

      const result = envManager.getConnectionInfo(serviceConfig, {});

      expect(result).toEqual({
        host: 'localhost',
        port: 0,
        user: '',
        database: '/app/db.sqlite3',
      });
    });

    it('should return default for generic service type', () => {
      const serviceConfig: ServiceConfig = {
        name: 'web',
        type: 'generic',
        image: 'node:18',
      };

      const result = envManager.getConnectionInfo(serviceConfig, {});

      expect(result).toEqual({
        host: 'localhost',
        port: 0,
        user: '',
        password: undefined,
        database: '',
      });
    });
  });

  describe('loadEnv', () => {
    it('should load env from .env file', () => {
      const envContent = 'NODE_ENV=production\nPORT=3000\n';
      writeFileSync(join(tempDir, '.env'), envContent);

      vi.mocked(existsSync).mockImplementation((path: string) => {
        return path === join(tempDir, '.env');
      });

      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === join(tempDir, '.env')) {
          return envContent;
        }
        return '';
      });

      const result = envManager.loadEnv(tempDir);

      expect(result.NODE_ENV).toBe('production');
      expect(result.PORT).toBe('3000');
    });

    it('should merge env from compose service config', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const serviceConfig: ServiceConfig = {
        name: 'web',
        type: 'generic',
        image: 'node:18',
        environment: {
          COMPOSE_VAR: 'from-compose',
          NODE_ENV: 'development',
        },
      };

      const result = envManager.loadEnv(tempDir, 'web', serviceConfig);

      expect(result.COMPOSE_VAR).toBe('from-compose');
      expect(result.NODE_ENV).toBe('development');
    });

    it('should merge env files with correct priority (local > env-specific > base)', () => {
      const baseContent = 'VAR1=base\nVAR2=base\nVAR3=base\n';
      const envContent = 'VAR2=env-specific\nVAR3=env-specific\n';
      const localContent = 'VAR3=local\n';

      writeFileSync(join(tempDir, '.env'), baseContent);
      writeFileSync(join(tempDir, '.env.development'), envContent);
      writeFileSync(join(tempDir, '.env.local'), localContent);

      vi.mocked(existsSync).mockImplementation((path: string) => {
        return [
          join(tempDir, '.env'),
          join(tempDir, '.env.development'),
          join(tempDir, '.env.local'),
        ].includes(path);
      });

      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === join(tempDir, '.env')) return baseContent;
        if (path === join(tempDir, '.env.development')) return envContent;
        if (path === join(tempDir, '.env.local')) return localContent;
        return '';
      });

      // Set NODE_ENV for test
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = envManager.loadEnv(tempDir);

      expect(result.VAR1).toBe('base');
      expect(result.VAR2).toBe('env-specific');
      expect(result.VAR3).toBe('local'); // local should override

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should return empty object when no files exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = envManager.loadEnv(tempDir);

      expect(result).toEqual({});
    });

    it('should handle parse errors gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = envManager.loadEnv(tempDir);

      // Should return empty object on error
      expect(result).toEqual({});
    });
  });
});

