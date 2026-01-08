/**
 * Tests for Profile Tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileTool } from '../../../src/tools/profile-tool.js';
import type { SSHConfig } from '../../../src/utils/ssh-config.js';
import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock profiles-file
vi.mock('../../../src/utils/profiles-file.js', () => ({
  loadProfilesFile: vi.fn(),
}));

describe('ProfileTool', () => {
  let profileTool: ProfileTool;
  let mockSSHConfig: SSHConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSSHConfig = {
      host: 'test.example.com',
      username: 'deployer',
      port: 22,
    };
  });

  describe('Constructor', () => {
    it('should initialize with SSH config for remote mode', () => {
      profileTool = new ProfileTool(mockSSHConfig);
      expect(profileTool).toBeInstanceOf(ProfileTool);
    });

    it('should initialize without SSH config for local mode', () => {
      profileTool = new ProfileTool(null);
      expect(profileTool).toBeInstanceOf(ProfileTool);
    });

    it('should initialize with profiles file path', () => {
      profileTool = new ProfileTool(mockSSHConfig, '/path/to/profiles.json');
      expect(profileTool).toBeInstanceOf(ProfileTool);
    });
  });

  describe('getTool()', () => {
    it('should return tool definition', () => {
      profileTool = new ProfileTool(null);
      const tool = profileTool.getTool();

      expect(tool).toBeDefined();
      expect(tool.name).toBe('docker_profile_info');
      expect(tool.description).toContain('SSH profile');
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('getProfileInfo() - Local Mode', () => {
    it('should return local mode when no SSH config', async () => {
      profileTool = new ProfileTool(null);
      const info = await profileTool.getProfileInfo();

      expect(info.mode).toBe('local');
      expect(info.current).toBeUndefined();
    });
  });

  describe('getProfileInfo() - Remote Mode', () => {
    it('should return remote mode with current config', async () => {
      profileTool = new ProfileTool(mockSSHConfig);
      const info = await profileTool.getProfileInfo();

      expect(info.mode).toBe('remote');
      expect(info.current).toBeDefined();
      expect(info.current?.host).toBe('test.example.com');
      expect(info.current?.username).toBe('deployer');
      expect(info.current?.port).toBe(22);
    });

    it('should use default port 22 when not specified', async () => {
      const configWithoutPort: SSHConfig = {
        host: 'test.example.com',
        username: 'deployer',
      };

      profileTool = new ProfileTool(configWithoutPort);
      const info = await profileTool.getProfileInfo();

      expect(info.current?.port).toBe(22);
    });

    it('should load profiles file if provided', async () => {
      const { loadProfilesFile } = await import('../../../src/utils/profiles-file.js');
      
      vi.mocked(loadProfilesFile).mockReturnValue({
        errors: [],
        config: {
          default: 'production',
          profiles: {
            production: {
              host: 'prod.example.com',
              username: 'deployer',
            },
            staging: {
              host: 'staging.example.com',
              username: 'deployer',
            },
          },
        },
      });

      profileTool = new ProfileTool(mockSSHConfig, '/path/to/profiles.json');
      const info = await profileTool.getProfileInfo();

      expect(info.profilesFile).toBe('/path/to/profiles.json');
      expect(info.availableProfiles).toEqual(['production', 'staging']);
      expect(info.defaultProfile).toBe('production');
      expect(loadProfilesFile).toHaveBeenCalledWith('/path/to/profiles.json');
    });

    it('should handle profiles file load errors gracefully', async () => {
      const { loadProfilesFile } = await import('../../../src/utils/profiles-file.js');
      
      vi.mocked(loadProfilesFile).mockImplementation(() => {
        throw new Error('File not found');
      });

      profileTool = new ProfileTool(mockSSHConfig, '/path/to/profiles.json');
      const info = await profileTool.getProfileInfo();

      expect(info.mode).toBe('remote');
      expect(info.current).toBeDefined();
      // Should not have profiles info due to error
      expect(info.availableProfiles).toBeUndefined();
    });

    it('should handle missing profiles file gracefully', async () => {
      const { loadProfilesFile } = await import('../../../src/utils/profiles-file.js');
      
      vi.mocked(loadProfilesFile).mockReturnValue({
        errors: ['File not found'],
        config: null,
      });

      profileTool = new ProfileTool(mockSSHConfig, '/path/to/profiles.json');
      const info = await profileTool.getProfileInfo();

      expect(info.mode).toBe('remote');
      expect(info.current).toBeDefined();
      // Should not have profiles info
      expect(info.availableProfiles).toBeUndefined();
    });
  });

  describe('handleCall()', () => {
    it('should return profile info in correct format', async () => {
      profileTool = new ProfileTool(mockSSHConfig);
      
      const request: CallToolRequest = {
        params: {
          name: 'docker_profile_info',
          arguments: {},
        },
      } as CallToolRequest;

      const result = await profileTool.handleCall(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const info = JSON.parse(result.content[0].text);
      expect(info.mode).toBe('remote');
      expect(info.current).toBeDefined();
    });

    it('should return local mode info', async () => {
      profileTool = new ProfileTool(null);
      
      const request: CallToolRequest = {
        params: {
          name: 'docker_profile_info',
          arguments: {},
        },
      } as CallToolRequest;

      const result = await profileTool.handleCall(request);

      const info = JSON.parse(result.content[0].text);
      expect(info.mode).toBe('local');
    });

    it('should handle errors gracefully', async () => {
      profileTool = new ProfileTool(mockSSHConfig);
      
      // Force error by mocking getProfileInfo
      vi.spyOn(profileTool, 'getProfileInfo').mockRejectedValue(new Error('Test error'));

      const request: CallToolRequest = {
        params: {
          name: 'docker_profile_info',
          arguments: {},
        },
      } as CallToolRequest;

      const result = await profileTool.handleCall(request);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });
  });
});
