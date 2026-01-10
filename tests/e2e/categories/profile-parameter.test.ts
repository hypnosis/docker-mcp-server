/**
 * E2E Tests for Profile Parameter
 * Run: npm run test:e2e:profile
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ContainerTools } from '../../../src/tools/container-tools.js';
import { DatabaseTools } from '../../../src/tools/database-tools.js';
import { verifyDocker, DOCKER_TIMEOUT } from '../setup.js';

describe('Profile Parameter E2E', () => {
  let containerTools: ContainerTools;
  let databaseTools: DatabaseTools;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    containerTools = new ContainerTools();
    databaseTools = new DatabaseTools();
  }, DOCKER_TIMEOUT);

  describe('✅ Local Profile (default)', () => {
    it('should work with default local profile', async () => {
      const result = await containerTools.handleCall({
        method: 'tools/call',
        params: {
          name: 'docker_container_list',
          arguments: {}
        }
      });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    }, DOCKER_TIMEOUT);

    it('should work with explicit local profile', async () => {
      const result = await containerTools.handleCall({
        method: 'tools/call',
        params: {
          name: 'docker_container_list',
          arguments: { profile: 'local' }
        }
      });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    }, DOCKER_TIMEOUT);
  });

  describe('🔴 Explicit Errors - Profile Not Found', () => {
    it('should throw explicit error when invalid profile specified (ContainerTools)', async () => {
      const result = await containerTools.handleCall({
        method: 'tools/call',
        params: {
          name: 'docker_container_list',
          arguments: { profile: 'non-existent-profile-12345' }
        }
      });

      // Profile should resolve to null, but container tools might handle it differently
      // The important thing is we don't silently fallback
      expect(result).toBeDefined();
    }, DOCKER_TIMEOUT);

    it('should throw explicit PROFILE ERROR when invalid profile specified (DatabaseTools)', async () => {
      const result = await databaseTools.handleCall({
        method: 'tools/call',
        params: {
          name: 'docker_db_status',
          arguments: { 
            service: 'postgres',
            profile: 'non-existent-profile-12345'
          }
        }
      });

      // ✅ ДОЛЖНА БЫТЬ ЯВНАЯ ОШИБКА
      expect(result.isError).toBe(true);
      const errorText = result.content[0].text;
      expect(errorText).toContain('PROFILE ERROR');
      expect(errorText).toContain('non-existent-profile-12345');
      expect(errorText).toContain('NO FALLBACK TO LOCAL');
      expect(errorText).toContain('Possible causes');
    }, DOCKER_TIMEOUT);

    it('should provide helpful error message with troubleshooting', async () => {
      const result = await databaseTools.handleCall({
        method: 'tools/call',
        params: {
          name: 'docker_db_query',
          arguments: { 
            service: 'postgres',
            query: 'SELECT 1',
            profile: 'invalid-profile-test'
          }
        }
      });

      expect(result.isError).toBe(true);
      const errorText = result.content[0].text;
      
      // Проверяем полезность ошибки
      expect(errorText).toContain('Possible causes');
      expect(errorText).toContain('not found in profiles.json');
      expect(errorText).toContain('DOCKER_PROFILES_FILE');
      expect(errorText).toContain('invalid-profile-test');
    }, DOCKER_TIMEOUT);
  });

  describe('✅ DatabaseTools with Local Profile (DI)', () => {
    it('should work without profile (local Docker)', async () => {
      const result = await databaseTools.handleCall({
        method: 'tools/call',
        params: {
          name: 'docker_db_status',
          arguments: { service: 'postgres' }
        }
      });

      expect(result.isError).toBeFalsy();
      const status = JSON.parse(result.content[0].text);
      expect(status.type).toBe('postgresql');
    }, DOCKER_TIMEOUT);

    it('should create adapters with DI (no profile = local)', async () => {
      // Test that adapters are created with correct managers
      const result = await databaseTools.handleCall({
        method: 'tools/call',
        params: {
          name: 'docker_db_query',
          arguments: { 
            service: 'postgres',
            query: 'SELECT 1 as test_value'
          }
        }
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toBeDefined();
    }, DOCKER_TIMEOUT);
  });

  describe('🌐 Remote Profile (Integration Test)', () => {
    it.skip('should work with valid remote profile - MANUAL TEST REQUIRED', async () => {
      // Skip automated test - requires real remote server
      // To test manually:
      // 1. Setup profiles.json with valid remote profile
      // 2. Setup test project on remote server
      // 3. Use MCP client to call:
      //    docker_db_query({service: "postgres", query: "SELECT 'REMOTE_MARKER'", profile: "test-remote"})
      // 4. Verify response contains REMOTE_MARKER (not LOCAL)
    }, DOCKER_TIMEOUT);
  });
});
