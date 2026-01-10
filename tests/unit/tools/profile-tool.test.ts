/**
 * Tests for Profile Tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileTool } from '../../../src/tools/profile-tool.js';
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

// Mock profile-resolver
vi.mock('../../../src/utils/profile-resolver.js', () => ({
  getAvailableProfiles: vi.fn(),
  getDefaultProfile: vi.fn(),
}));

import { getAvailableProfiles, getDefaultProfile } from '../../../src/utils/profile-resolver.js';

const mockGetAvailableProfiles = vi.mocked(getAvailableProfiles);
const mockGetDefaultProfile = vi.mocked(getDefaultProfile);

describe('ProfileTool', () => {
  let profileTool: ProfileTool;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.DOCKER_PROFILES;
    delete process.env.DOCKER_PROFILES_FILE;
    
    profileTool = new ProfileTool();
    
    // Default mocks for local mode
    mockGetAvailableProfiles.mockReturnValue([]);
    mockGetDefaultProfile.mockReturnValue('local');
  });

  describe('Constructor', () => {
    it('should initialize', () => {
      expect(profileTool).toBeInstanceOf(ProfileTool);
    });
  });

  describe('getTool()', () => {
    it('should return tool definition', () => {
      const tool = profileTool.getTool();

      expect(tool).toBeDefined();
      expect(tool.name).toBe('docker_profile_info');
      expect(tool.description).toContain('SSH profile');
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('getProfileInfo() - Local Mode', () => {
    it('should return local mode when no profiles configured', async () => {
      mockGetAvailableProfiles.mockReturnValue([]);
      mockGetDefaultProfile.mockReturnValue('local');
      
      const info = await profileTool.getProfileInfo();

      expect(info.mode).toBe('local');
      expect(info.availableProfiles).toEqual([]);
      expect(info.defaultProfile).toBe('local');
    });
  });

  describe('getProfileInfo() - Remote Mode', () => {
    it('should return remote mode when profiles configured', async () => {
      process.env.DOCKER_PROFILES = JSON.stringify({
        default: 'production',
        profiles: {
          production: { host: 'prod.example.com', username: 'deployer' },
        },
      });
      
      mockGetAvailableProfiles.mockReturnValue(['production']);
      mockGetDefaultProfile.mockReturnValue('production');
      
      const info = await profileTool.getProfileInfo();

      expect(info.mode).toBe('remote');
      expect(info.availableProfiles).toEqual(['production']);
      expect(info.defaultProfile).toBe('production');
      expect(info.DOCKER_PROFILES_configured).toBe(true);
    });

    it('should use default port when not specified', async () => {
      // This test is not applicable anymore as ProfileTool doesn't use SSH config directly
      // Skipping as it's not relevant with new implementation
    });

    it('should load profiles from DOCKER_PROFILES_FILE', async () => {
      process.env.DOCKER_PROFILES_FILE = '/path/to/profiles.json';
      mockGetAvailableProfiles.mockReturnValue(['production', 'staging']);
      mockGetDefaultProfile.mockReturnValue('production');
      
      const info = await profileTool.getProfileInfo();

      expect(info.availableProfiles).toEqual(['production', 'staging']);
      expect(info.defaultProfile).toBe('production');
      expect(info.source).toBe('DOCKER_PROFILES_FILE');
    });

    it('should handle missing profiles file gracefully', async () => {
      delete process.env.DOCKER_PROFILES;
      delete process.env.DOCKER_PROFILES_FILE;
      mockGetAvailableProfiles.mockReturnValue([]);
      mockGetDefaultProfile.mockReturnValue('local');
      
      const info = await profileTool.getProfileInfo();

      expect(info.mode).toBe('local');
      expect(info.DOCKER_PROFILES_configured).toBe(false);
    });
  });

  describe('handleCall()', () => {
    it('should return profile info in correct format', async () => {
      process.env.DOCKER_PROFILES = JSON.stringify({
        default: 'production',
        profiles: { production: { host: 'prod.example.com', username: 'deployer' } },
      });
      mockGetAvailableProfiles.mockReturnValue(['production']);
      mockGetDefaultProfile.mockReturnValue('production');
      
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
      expect(info.availableProfiles).toEqual(['production']);
    });

    it('should return local mode info', async () => {
      delete process.env.DOCKER_PROFILES;
      delete process.env.DOCKER_PROFILES_FILE;
      mockGetAvailableProfiles.mockReturnValue([]);
      mockGetDefaultProfile.mockReturnValue('local');
      
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
