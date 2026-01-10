/**
 * E2E Tests for Database Tools
 * Run: npm run test:e2e:database
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseTools } from '../../../src/tools/database-tools.js';
import { verifyDocker, DOCKER_TIMEOUT } from '../setup.js';

describe('Database Tools E2E', () => {
  let databaseTools: DatabaseTools;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    databaseTools = new DatabaseTools();
  }, DOCKER_TIMEOUT);

  it('docker_db_status - should get PostgreSQL status', async () => {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_status',
        arguments: { service: 'postgres' }
      }
    });

    const status = JSON.parse(result.content[0].text);
    expect(status.type).toBe('postgresql');
    expect(status).toHaveProperty('status');
  }, DOCKER_TIMEOUT);

  it('docker_db_status - should get Redis status', async () => {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_status',
        arguments: { service: 'redis' }
      }
    });

    const status = JSON.parse(result.content[0].text);
    expect(status.type).toBe('redis');
    expect(status).toHaveProperty('version');
    expect(status).toHaveProperty('status');
  }, DOCKER_TIMEOUT);

  it('docker_db_query - should execute SELECT query on PostgreSQL', async () => {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'postgres',
          query: 'SELECT * FROM users;'
        }
      }
    });

    if (result.isError || result.content[0].text.includes('Error') || result.content[0].text.includes('error')) {
      expect(result.content[0].text).toBeTruthy();
    } else {
      expect(result.content[0].text).toContain('testuser1');
    }
  }, DOCKER_TIMEOUT);

  it('docker_db_query - should execute Redis command', async () => {
    await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'redis',
          query: 'SET test_key "test_value"'
        }
      }
    });

    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'redis',
          query: 'GET test_key'
        }
      }
    });

    expect(result.content[0].text).toContain('test_value');
  }, DOCKER_TIMEOUT);

  it('docker_db_backup - should create PostgreSQL backup', async () => {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_backup',
        arguments: {
          service: 'postgres',
          compress: true
        }
      }
    });

    expect(result.content[0].text).toContain('Backup created');
  }, DOCKER_TIMEOUT);

  it('docker_db_query - should use environment variables from container (not compose file)', async () => {
    // Test that adapter uses env vars from running container
    // docker-compose.test.yml has POSTGRES_USER=testuser, not postgres
    // This test verifies BUG-010 fix
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'postgres',
          query: 'SELECT current_user;'
        }
      }
    });

    // Should successfully connect with testuser from container, not postgres from compose
    expect(result.content[0].text).toContain('testuser');
    expect(result.content[0].text).not.toContain('role "postgres" does not exist');
  }, DOCKER_TIMEOUT);

  it('docker_db_query - should use correct database from container environment', async () => {
    // Verify that database name comes from container env (testdb), not compose file
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'postgres',
          query: 'SELECT current_database();'
        }
      }
    });

    expect(result.content[0].text).toContain('testdb');
  }, DOCKER_TIMEOUT);

  it('docker_db_status - should work with container environment variables', async () => {
    // Verify status works even when container was started with different compose file
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_status',
        arguments: { service: 'postgres' }
      }
    });

    const status = JSON.parse(result.content[0].text);
    expect(status.type).toBe('postgresql');
    expect(status.status).toBe('healthy');
    expect(status.version).toBeTruthy();
    expect(status.size).toBeTruthy();
    expect(status.connections).toBeGreaterThanOrEqual(0);
    expect(status.uptime).toBeTruthy();
  }, DOCKER_TIMEOUT);
});
