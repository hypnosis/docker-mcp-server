/**
 * Profile Management Tool
 * Show and manage SSH profiles
 */

import {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { loadProfilesFile } from '../utils/profiles-file.js';
import type { SSHConfig } from '../utils/ssh-config.js';

export class ProfileTool {
  private sshConfig: SSHConfig | null;
  private profilesFile: string | undefined;

  constructor(sshConfig?: SSHConfig | null, profilesFile?: string) {
    this.sshConfig = sshConfig || null;
    this.profilesFile = profilesFile;
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
    current?: {
      host: string;
      port: number;
      username: string;
    };
    profilesFile?: string;
    availableProfiles?: string[];
    defaultProfile?: string;
  }> {
    // Local mode
    if (!this.sshConfig) {
      return {
        mode: 'local',
      };
    }

    // Remote mode
    const result: any = {
      mode: 'remote',
      current: {
        host: this.sshConfig.host,
        port: this.sshConfig.port || 22,
        username: this.sshConfig.username,
      },
    };

    // Load profiles file if available
    if (this.profilesFile) {
      result.profilesFile = this.profilesFile;
      
      try {
        const profilesResult = loadProfilesFile(this.profilesFile);
        
        if (profilesResult.config) {
          result.availableProfiles = Object.keys(profilesResult.config.profiles);
          result.defaultProfile = profilesResult.config.default;
        }
      } catch (error: any) {
        logger.warn(`Failed to load profiles file: ${error.message}`);
      }
    }

    return result;
  }
}
