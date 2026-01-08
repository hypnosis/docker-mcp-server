/**
 * Tests for SSH Configuration Module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateSSHConfig,
  loadSSHConfig,
  loadSSHProfiles,
  getActiveSSHProfile,
  checkSSHKeyExists,
  type SSHConfig,
} from '../../../src/utils/ssh-config.js';
import { existsSync } from 'fs';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
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

describe('SSH Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSSHConfig', () => {
    it('should validate correct SSH config', () => {
      const config: SSHConfig = {
        host: 'example.com',
        port: 22,
        username: 'deployer',
        privateKeyPath: '/path/to/id_rsa',
      };

      const errors = validateSSHConfig(config);
      expect(errors).toEqual([]);
    });

    it('should require host', () => {
      const config: Partial<SSHConfig> = {
        username: 'user',
      };

      const errors = validateSSHConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('host'))).toBe(true);
    });

    it('should require username', () => {
      const config: Partial<SSHConfig> = {
        host: 'example.com',
      };

      const errors = validateSSHConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('username'))).toBe(true);
    });

    it('should validate port range', () => {
      const config1: Partial<SSHConfig> = {
        host: 'example.com',
        username: 'user',
        port: 0,
      };

      const config2: Partial<SSHConfig> = {
        host: 'example.com',
        username: 'user',
        port: 65536,
      };

      const errors1 = validateSSHConfig(config1);
      const errors2 = validateSSHConfig(config2);

      expect(errors1.some((e) => e.includes('port'))).toBe(true);
      expect(errors2.some((e) => e.includes('port'))).toBe(true);
    });

    it('should accept valid port', () => {
      const config: SSHConfig = {
        host: 'example.com',
        username: 'user',
        port: 2222,
      };

      const errors = validateSSHConfig(config);
      expect(errors.length).toBe(0);
    });

    it('should validate privateKeyPath', () => {
      const config: Partial<SSHConfig> = {
        host: 'example.com',
        username: 'user',
        privateKeyPath: '', // Empty path
      };

      const errors = validateSSHConfig(config);
      expect(errors.some((e) => e.includes('privateKeyPath'))).toBe(true);
    });

    it('should accept config with password instead of key', () => {
      const config: SSHConfig = {
        host: 'example.com',
        username: 'user',
        password: 'password123',
      };

      const errors = validateSSHConfig(config);
      // Should not error (only warn)
      expect(errors.length).toBe(0);
    });
  });

  describe('loadSSHConfig', () => {
    it('should load config from environment variables', () => {
      const env = {
        DOCKER_SSH_HOST: 'example.com',
        DOCKER_SSH_USER: 'deployer',
        DOCKER_SSH_PORT: '22',
        DOCKER_SSH_KEY: '/path/to/id_rsa',
      };

      const result = loadSSHConfig(env);

      expect(result.errors).toEqual([]);
      expect(result.config).not.toBeNull();
      expect(result.config?.host).toBe('example.com');
      expect(result.config?.username).toBe('deployer');
      expect(result.config?.port).toBe(22);
      expect(result.config?.privateKeyPath).toBe('/path/to/id_rsa');
    });

    it('should use default port 22 when not specified', () => {
      const env = {
        DOCKER_SSH_HOST: 'example.com',
        DOCKER_SSH_USER: 'deployer',
      };

      const result = loadSSHConfig(env);

      expect(result.config?.port).toBe(22);
    });

    it('should support DOCKER_SSH_USERNAME alias', () => {
      const env = {
        DOCKER_SSH_HOST: 'example.com',
        DOCKER_SSH_USERNAME: 'deployer',
      };

      const result = loadSSHConfig(env);

      expect(result.config?.username).toBe('deployer');
    });

    it('should support multiple key path env vars', () => {
      const testCases = [
        { DOCKER_SSH_KEY: '/path/to/key1' },
        { DOCKER_SSH_PRIVATE_KEY: '/path/to/key2' },
        { DOCKER_SSH_KEY_PATH: '/path/to/key3' },
      ];

      testCases.forEach((envVar) => {
        const env = {
          DOCKER_SSH_HOST: 'example.com',
          DOCKER_SSH_USER: 'deployer',
          ...envVar,
        };

        const result = loadSSHConfig(env);
        expect(result.config?.privateKeyPath).toBe(Object.values(envVar)[0]);
      });
    });

    it('should load passphrase and password', () => {
      const env = {
        DOCKER_SSH_HOST: 'example.com',
        DOCKER_SSH_USER: 'deployer',
        DOCKER_SSH_PASSPHRASE: 'passphrase123',
        DOCKER_SSH_PASSWORD: 'password123',
      };

      const result = loadSSHConfig(env);

      expect(result.config?.passphrase).toBe('passphrase123');
      expect(result.config?.password).toBe('password123');
    });

    it('should return null config when no SSH vars present', () => {
      const env = {};

      const result = loadSSHConfig(env);

      expect(result.config).toBeNull();
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid port', () => {
      const env = {
        DOCKER_SSH_HOST: 'example.com',
        DOCKER_SSH_USER: 'deployer',
        DOCKER_SSH_PORT: 'invalid',
      };

      const result = loadSSHConfig(env);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('DOCKER_SSH_PORT'))).toBe(true);
    });

    it('should return errors for missing required fields', () => {
      const env = {
        DOCKER_SSH_HOST: 'example.com',
        // Missing username
      };

      const result = loadSSHConfig(env);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.config).toBeNull();
    });

    it('should load from active profile when DOCKER_SSH_PROFILE is set', () => {
      const env = {
        DOCKER_SSH_PROFILE: 'production',
        DOCKER_SSH_PROFILES: JSON.stringify({
          production: {
            host: 'prod.example.com',
            username: 'deployer',
            port: 22,
          },
          staging: {
            host: 'staging.example.com',
            username: 'deployer',
          },
        }),
      };

      const result = loadSSHConfig(env);

      expect(result.errors).toEqual([]);
      expect(result.config).not.toBeNull();
      expect(result.config?.host).toBe('prod.example.com');
      expect(result.config?.username).toBe('deployer');
    });

    it('should return error for non-existent profile', () => {
      const env = {
        DOCKER_SSH_PROFILE: 'nonexistent',
        DOCKER_SSH_PROFILES: JSON.stringify({
          production: {
            host: 'prod.example.com',
            username: 'deployer',
          },
        }),
      };

      const result = loadSSHConfig(env);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('nonexistent'))).toBe(true);
      expect(result.config).toBeNull();
    });
  });

  describe('loadSSHProfiles', () => {
    it('should load profiles from DOCKER_SSH_PROFILES', () => {
      const env = {
        DOCKER_SSH_PROFILES: JSON.stringify({
          production: {
            host: 'prod.example.com',
            username: 'deployer',
            port: 22,
          },
          staging: {
            host: 'staging.example.com',
            username: 'deployer',
            port: 2222,
          },
        }),
      };

      const result = loadSSHProfiles(env);

      expect(result.errors).toEqual([]);
      expect(Object.keys(result.profiles)).toHaveLength(2);
      expect(result.profiles.production.host).toBe('prod.example.com');
      expect(result.profiles.staging.host).toBe('staging.example.com');
      expect(result.profiles.staging.port).toBe(2222);
    });

    it('should use default port 22 when not specified in profile', () => {
      const env = {
        DOCKER_SSH_PROFILES: JSON.stringify({
          test: {
            host: 'test.example.com',
            username: 'user',
          },
        }),
      };

      const result = loadSSHProfiles(env);

      expect(result.profiles.test.port).toBe(22);
    });

    it('should support both privateKeyPath and key in profiles', () => {
      const env1 = {
        DOCKER_SSH_PROFILES: JSON.stringify({
          test1: {
            host: 'test1.com',
            username: 'user',
            privateKeyPath: '/path/to/key1',
          },
        }),
      };

      const env2 = {
        DOCKER_SSH_PROFILES: JSON.stringify({
          test2: {
            host: 'test2.com',
            username: 'user',
            key: '/path/to/key2',
          },
        }),
      };

      const result1 = loadSSHProfiles(env1);
      const result2 = loadSSHProfiles(env2);

      expect(result1.profiles.test1.privateKeyPath).toBe('/path/to/key1');
      expect(result2.profiles.test2.privateKeyPath).toBe('/path/to/key2');
    });

    it('should return empty profiles when DOCKER_SSH_PROFILES not set', () => {
      const env = {};

      const result = loadSSHProfiles(env);

      expect(result.profiles).toEqual({});
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid JSON', () => {
      const env = {
        DOCKER_SSH_PROFILES: 'invalid json',
      };

      const result = loadSSHProfiles(env);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.profiles).toEqual({});
    });

    it('should return errors for non-object JSON', () => {
      const env = {
        DOCKER_SSH_PROFILES: '["array", "not", "object"]',
      };

      const result = loadSSHProfiles(env);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('must be a JSON object'))).toBe(true);
    });

    it('should validate each profile and report errors', () => {
      const env = {
        DOCKER_SSH_PROFILES: JSON.stringify({
          valid: {
            host: 'valid.com',
            username: 'user',
          },
          invalid: {
            // Missing host and username
            port: 22,
          },
          alsoInvalid: 'not an object',
        }),
      };

      const result = loadSSHProfiles(env);

      // Should load valid profile
      expect(result.profiles.valid).toBeDefined();
      
      // Should report errors for invalid profiles
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('invalid'))).toBe(true);
      expect(result.errors.some((e) => e.includes('alsoInvalid'))).toBe(true);
    });

    it('should handle passphrase and password in profiles', () => {
      const env = {
        DOCKER_SSH_PROFILES: JSON.stringify({
          test: {
            host: 'test.com',
            username: 'user',
            passphrase: 'pass123',
            password: 'pwd456',
          },
        }),
      };

      const result = loadSSHProfiles(env);

      expect(result.profiles.test.passphrase).toBe('pass123');
      expect(result.profiles.test.password).toBe('pwd456');
    });
  });

  describe('getActiveSSHProfile', () => {
    it('should return active profile name', () => {
      const env = {
        DOCKER_SSH_PROFILE: 'production',
      };

      const profile = getActiveSSHProfile(env);
      expect(profile).toBe('production');
    });

    it('should return null when no profile set', () => {
      const env = {};

      const profile = getActiveSSHProfile(env);
      expect(profile).toBeNull();
    });
  });

  describe('checkSSHKeyExists', () => {
    it('should return true when key exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const exists = checkSSHKeyExists('/path/to/key');
      expect(exists).toBe(true);
    });

    it('should return false when key does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const exists = checkSSHKeyExists('/path/to/key');
      expect(exists).toBe(false);
    });

    it('should handle ~ in path', () => {
      const originalHome = process.env.HOME;
      process.env.HOME = '/home/user';

      vi.mocked(existsSync).mockImplementation((path: string) => {
        return path === '/home/user/.ssh/id_rsa';
      });

      const exists = checkSSHKeyExists('~/.ssh/id_rsa');
      expect(exists).toBe(true);

      process.env.HOME = originalHome;
    });

    it('should handle errors gracefully', () => {
      vi.mocked(existsSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const exists = checkSSHKeyExists('/invalid/path');
      expect(exists).toBe(false);
    });
  });
});

