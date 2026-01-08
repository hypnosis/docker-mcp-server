/**
 * Profiles File Loader
 * Load SSH profiles from JSON configuration file
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from './logger.js';
import type { SSHConfig } from './ssh-config.js';

/**
 * Profiles configuration file structure
 */
export interface ProfilesConfig {
  /** Default profile name to use if not specified */
  default?: string;
  /** SSH profiles by name */
  profiles: Record<string, SSHProfileData>;
}

/**
 * SSH profile data in config file
 */
export interface SSHProfileData {
  host: string;
  username: string;
  port?: number;
  privateKeyPath?: string;
  passphrase?: string;
  password?: string;
  /** Base path for Docker projects on remote server (e.g., "/var/www") */
  projectsPath?: string;
}

/**
 * Result of loading profiles file
 */
export interface ProfilesFileResult {
  /** Loaded profiles configuration */
  config: ProfilesConfig | null;
  /** Validation errors */
  errors: string[];
}

/**
 * Load profiles from JSON file
 * 
 * @param filePath - Path to profiles JSON file
 * @returns Profiles configuration and errors
 */
export function loadProfilesFile(filePath: string): ProfilesFileResult {
  const errors: string[] = [];

  try {
    // Resolve path (support ~ for home directory)
    const resolvedPath = resolveFilePath(filePath);

    // Check if file exists
    if (!existsSync(resolvedPath)) {
      errors.push(`Profiles file not found: ${resolvedPath}`);
      return { config: null, errors };
    }

    // Read and parse JSON
    const fileContent = readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(fileContent);

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      errors.push('Profiles file must contain a JSON object');
      return { config: null, errors };
    }

    if (!parsed.profiles || typeof parsed.profiles !== 'object') {
      errors.push('Profiles file must have a "profiles" object');
      return { config: null, errors };
    }

    // Validate each profile
    const profiles: Record<string, SSHProfileData> = {};
    for (const [name, data] of Object.entries(parsed.profiles)) {
      if (typeof data !== 'object' || data === null) {
        errors.push(`Profile "${name}" must be an object`);
        continue;
      }

      const profile = data as any;

      // Validate required fields
      if (!profile.host || typeof profile.host !== 'string') {
        errors.push(`Profile "${name}" must have a "host" string`);
        continue;
      }

      if (!profile.username || typeof profile.username !== 'string') {
        errors.push(`Profile "${name}" must have a "username" string`);
        continue;
      }

      // Build profile
      const profileData: SSHProfileData = {
        host: profile.host.trim(),
        username: profile.username.trim(),
      };

      // Optional fields
      if (profile.port !== undefined) {
        const port = typeof profile.port === 'number' ? profile.port : parseInt(String(profile.port), 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          errors.push(`Profile "${name}" has invalid port: ${profile.port}`);
          continue;
        }
        profileData.port = port;
      }

      if (profile.privateKeyPath && typeof profile.privateKeyPath === 'string') {
        profileData.privateKeyPath = profile.privateKeyPath.trim();
      }

      if (profile.passphrase && typeof profile.passphrase === 'string') {
        profileData.passphrase = profile.passphrase;
      }

      if (profile.password && typeof profile.password === 'string') {
        profileData.password = profile.password;
      }

      if (profile.projectsPath && typeof profile.projectsPath === 'string') {
        profileData.projectsPath = profile.projectsPath.trim();
      }

      profiles[name] = profileData;
    }

    if (Object.keys(profiles).length === 0) {
      errors.push('No valid profiles found in file');
      return { config: null, errors };
    }

    // Build config
    const config: ProfilesConfig = {
      profiles,
    };

    // Set default profile if specified
    if (parsed.default && typeof parsed.default === 'string') {
      if (profiles[parsed.default]) {
        config.default = parsed.default;
      } else {
        errors.push(`Default profile "${parsed.default}" not found in profiles`);
      }
    }

    if (errors.length > 0) {
      return { config: null, errors };
    }

    logger.info(`Loaded ${Object.keys(profiles).length} profiles from ${resolvedPath}`);
    if (config.default) {
      logger.info(`Default profile: ${config.default}`);
    }

    return { config, errors: [] };
  } catch (error: any) {
    if (error.name === 'SyntaxError') {
      errors.push(`Invalid JSON in profiles file: ${error.message}`);
    } else {
      errors.push(`Failed to load profiles file: ${error.message}`);
    }
    return { config: null, errors };
  }
}

/**
 * Convert profile data to SSHConfig
 */
export function profileDataToSSHConfig(data: SSHProfileData): SSHConfig {
  return {
    host: data.host,
    username: data.username,
    port: data.port || 22,
    privateKeyPath: data.privateKeyPath,
    passphrase: data.passphrase,
    password: data.password,
  };
}

/**
 * Resolve file path with ~ expansion
 */
function resolveFilePath(filePath: string): string {
  if (filePath.startsWith('~')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return filePath.replace('~', home);
  }
  return resolve(filePath);
}
