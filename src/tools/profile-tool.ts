/**
 * Profile Management Tool
 * Show and manage SSH profiles
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { getAvailableProfiles, getDefaultProfile } from '../utils/profile-resolver.js';

export class ProfileTool {
  constructor() {
    // SSH config is resolved per-tool call via resolveSSHConfig()
  }

  /**
   * Register profile tool
   */
  getTool(): Tool {
    return {
      name: 'docker_profile_info',
      description: 'Show current SSH profile and available profiles',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  /**
   * Handle tool call
   */
  async handleCall(request: CallToolRequest) {
    try {
      const info = await this.getProfileInfo();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (error: any) {
      logger.error('Profile info failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Get profile information
   */
  async getProfileInfo(): Promise<{
    mode: 'local' | 'remote';
    availableProfiles: string[];
    defaultProfile: string;
    source: string;
    DOCKER_PROFILES_configured: boolean;
  }> {
    // Load profiles from DOCKER_PROFILES ENV
    const profiles = getAvailableProfiles();
    const defaultProfile = getDefaultProfile();
    const hasProfiles = profiles.length > 0 && (process.env.DOCKER_PROFILES || process.env.DOCKER_PROFILES_FILE);

    const result = {
      mode: (hasProfiles && defaultProfile !== 'local' ? 'remote' : 'local') as 'local' | 'remote',
      availableProfiles: profiles,
      defaultProfile: defaultProfile,
      source: process.env.DOCKER_PROFILES_FILE ? 'DOCKER_PROFILES_FILE' : 'DOCKER_PROFILES_ENV',
      DOCKER_PROFILES_configured: !!(process.env.DOCKER_PROFILES || process.env.DOCKER_PROFILES_FILE),
    };

    return result;
  }
}
