/**
 * Tests for profiles-file.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadProfilesFile } from '../../../src/utils/profiles-file.js';

describe('profiles-file', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `docker-mcp-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, 'profiles.json');
  });

  afterEach(() => {
    try {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadProfilesFile', () => {
    it('should load valid profiles file', () => {
      const profiles = {
        default: 'prod',
        profiles: {
          prod: {
            host: 'prod.example.com',
            username: 'deployer',
            port: 22,
          },
          staging: {
            host: 'staging.example.com',
            username: 'deployer',
            port: 2222,
          },
        },
      };

      writeFileSync(testFile, JSON.stringify(profiles, null, 2));

      const result = loadProfilesFile(testFile);
      expect(result.errors).toEqual([]);
      expect(result.config).toBeDefined();
      expect(result.config?.default).toBe('prod');
      expect(result.config?.profiles).toHaveProperty('prod');
      expect(result.config?.profiles).toHaveProperty('staging');
      expect(result.config?.profiles.prod.host).toBe('prod.example.com');
    });

    it('should return error for non-existent file', () => {
      const result = loadProfilesFile('/nonexistent/profiles.json');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found');
      expect(result.config).toBeNull();
    });

    it('should return error for invalid JSON', () => {
      writeFileSync(testFile, 'invalid json {{{');

      const result = loadProfilesFile(testFile);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid JSON');
      expect(result.config).toBeNull();
    });

    it('should return error for non-object JSON', () => {
      writeFileSync(testFile, JSON.stringify(['array', 'not', 'object']));

      const result = loadProfilesFile(testFile);
      expect(result.errors.length).toBeGreaterThan(0);
      // Array passes first check but fails on profiles check
      expect(result.errors[0]).toContain('profiles');
      expect(result.config).toBeNull();
    });

    it('should return error for missing profiles field', () => {
      writeFileSync(testFile, JSON.stringify({ default: 'prod' }));

      const result = loadProfilesFile(testFile);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('must have a "profiles" object');
      expect(result.config).toBeNull();
    });

    it('should skip invalid profile entries', () => {
      const profiles = {
        profiles: {
          valid: {
            host: 'valid.example.com',
            username: 'user',
          },
          invalid1: {
            host: 'missing-username.example.com',
            // Missing username
          },
          invalid2: {
            username: 'user',
            // Missing host
          },
          invalid3: 'not an object',
        },
      };

      writeFileSync(testFile, JSON.stringify(profiles, null, 2));

      const result = loadProfilesFile(testFile);
      // Should have errors but still return config with valid profiles
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.config).toBeDefined();
      
      if (result.config) {
        expect(result.config.profiles).toHaveProperty('valid');
        expect(result.config.profiles).not.toHaveProperty('invalid1');
        expect(result.config.profiles).not.toHaveProperty('invalid2');
        expect(result.config.profiles).not.toHaveProperty('invalid3');
      }
    });

    it('should handle profiles without default', () => {
      const profiles = {
        profiles: {
          prod: {
            host: 'prod.example.com',
            username: 'deployer',
          },
        },
      };

      writeFileSync(testFile, JSON.stringify(profiles, null, 2));

      const result = loadProfilesFile(testFile);
      expect(result.errors).toEqual([]);
      expect(result.config).toBeDefined();
      expect(result.config?.default).toBeUndefined();
      expect(result.config?.profiles).toHaveProperty('prod');
    });

    it('should handle tilde in path', () => {
      // This test just verifies that tilde expansion doesn't crash
      // Actual expansion is tested implicitly by other tests
      const result = loadProfilesFile('~/nonexistent/profiles.json');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.config).toBeNull();
    });

    it('should handle profiles with optional fields', () => {
      const profiles = {
        profiles: {
          full: {
            host: 'full.example.com',
            username: 'user',
            port: 2222,
            privateKeyPath: '~/.ssh/id_rsa',
            passphrase: 'secret',
          },
          minimal: {
            host: 'minimal.example.com',
            username: 'user',
          },
        },
      };

      writeFileSync(testFile, JSON.stringify(profiles, null, 2));

      const result = loadProfilesFile(testFile);
      expect(result.errors).toEqual([]);
      expect(result.config).toBeDefined();
      expect(result.config?.profiles.full.port).toBe(2222);
      expect(result.config?.profiles.full.privateKeyPath).toBe('~/.ssh/id_rsa');
      expect(result.config?.profiles.minimal.port).toBeUndefined();
    });
  });
});
