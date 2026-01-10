/**
 * E2E Tests for Utility Tools
 * Run: npm run test:e2e:utility
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPHealthTool } from '../../../src/tools/mcp-health-tool.js';
import { ProfileTool } from '../../../src/tools/profile-tool.js';
import { verifyDocker, DOCKER_TIMEOUT } from '../setup.js';

describe('Utility Tools E2E', () => {
  let mcpHealthTool: MCPHealthTool;
  let profileTool: ProfileTool;

  beforeAll(async () => {
    await verifyDocker(); // Проверяем что Docker работает (контейнеры уже подняты глобально)
    mcpHealthTool = new MCPHealthTool();
    profileTool = new ProfileTool();
  }, DOCKER_TIMEOUT);

  it('docker_mcp_health - should return MCP server health', async () => {
    const result = await mcpHealthTool.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_mcp_health',
        arguments: {}
      }
    });

    const health = JSON.parse(result.content[0].text);
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('checks');
    expect(health.checks.docker).toHaveProperty('status');
  }, DOCKER_TIMEOUT);

  it('docker_profile_info - should return profile information', async () => {
    const result = await profileTool.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_profile_info',
        arguments: {}
      }
    });

    const profile = JSON.parse(result.content[0].text);
    expect(profile).toHaveProperty('mode');
  }, DOCKER_TIMEOUT);
});
