/**
 * Profile Resolver - Load SSH profiles from environment variables
 * 
 * Profiles are loaded ONCE from DOCKER_PROFILES environment variable at module import.
 * This provides synchronous access with zero I/O overhead.
 * 
 * @example ENV configuration
 * ```json
 * {
 *   "default": "local",
 *   "profiles": {
 *     "local": { "mode": "local" },
 *     "production": {
 *       "host": "prod.example.com",
 *       "username": "deployer",
 *       "port": 22,
 *       "privateKeyPath": "~/.ssh/id_rsa",
 *       "projectsPath": "/var/www"
 *     }
 *   }
 * }
 * ```
 */

import { homedir } from 'os';
import { logger } from './logger.js';
import type { SSHConfig } from './ssh-config.js';
import { loadProfilesFile, type SSHProfileData } from './profiles-file.js';

/**
 * Profile data from DOCKER_PROFILES ENV
 * Can have 'mode' field for local/ssh distinction
 */
interface ProfileData extends Partial<SSHConfig> {
  mode?: 'local' | 'ssh';
}

/**
 * Profiles configuration structure
 */
interface ProfilesConfig {
  default: string;
  profiles: Record<string, ProfileData | SSHProfileData>;
}

/**
 * Load profiles from file or environment variable
 * This function runs ONCE at module import time
 * 
 * Priority:
 * 1. DOCKER_PROFILES_FILE - path to JSON file (recommended, old system)
 * 2. DOCKER_PROFILES - JSON string in env var (new system)
 * 3. Fallback to local-only mode
 */
function loadProfilesFromEnv(): ProfilesConfig {
  // Priority 1: Load from file (DOCKER_PROFILES_FILE)
  const profilesFile = process.env.DOCKER_PROFILES_FILE;
  
  if (profilesFile) {
    logger.debug(`Loading profiles from file: ${profilesFile}`);
    
    try {
      const result = loadProfilesFile(profilesFile);
      
      if (result.errors.length > 0) {
        logger.error('Errors loading profiles file:', result.errors);
        logger.warn('Falling back to DOCKER_PROFILES env var or local-only mode');
      } else if (result.config) {
        const profileCount = Object.keys(result.config.profiles).length;
        logger.info(`Loaded ${profileCount} profiles from file: ${profilesFile}`);
        
        return {
          default: result.config.default || 'local',
          profiles: result.config.profiles as Record<string, ProfileData | SSHProfileData>
        };
      }
    } catch (err: any) {
      logger.error(`Exception loading profiles file: ${err.message}`);
      logger.warn('Falling back to DOCKER_PROFILES env var or local-only mode');
    }
  }
  
  // Priority 2: Load from DOCKER_PROFILES env var
  const envProfiles = process.env.DOCKER_PROFILES;
  
  if (envProfiles) {
    logger.debug('Loading profiles from DOCKER_PROFILES env var');
    
    try {
      let parsed: ProfilesConfig;
      
      if (typeof envProfiles === 'string') {
        parsed = JSON.parse(envProfiles) as ProfilesConfig;
      } else if (typeof envProfiles === 'object' && envProfiles !== null) {
        parsed = envProfiles as any as ProfilesConfig;
      } else {
        throw new Error(`Unexpected type: ${typeof envProfiles}`);
      }
      
      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('DOCKER_PROFILES must be a JSON object');
      }
      
      if (!parsed.profiles || typeof parsed.profiles !== 'object') {
        throw new Error('DOCKER_PROFILES must have a "profiles" object');
      }
      
      if (!parsed.default || typeof parsed.default !== 'string') {
        throw new Error('DOCKER_PROFILES must have a "default" string');
      }
      
      const profileCount = Object.keys(parsed.profiles).length;
      logger.info(`Loaded ${profileCount} profiles from DOCKER_PROFILES env var`);
      
      return parsed;
    } catch (err: any) {
      logger.error(`Error parsing DOCKER_PROFILES: ${err.message}`);
      logger.warn('Falling back to local-only mode');
      logger.debug(`DOCKER_PROFILES value (first 200 chars): ${typeof envProfiles === 'string' ? envProfiles.substring(0, 200) : JSON.stringify(envProfiles).substring(0, 200)}`);
    }
  } else {
    logger.debug('DOCKER_PROFILES variable not set, using local-only mode');
  }
  
  // Fallback: local-only mode
  logger.info('Using local-only mode (fallback)');
  return {
    default: 'local',
    profiles: {
      local: { mode: 'local' }
    }
  };
}

/**
 * Profiles loaded at module initialization (once)
 */
const PROFILES: ProfilesConfig = loadProfilesFromEnv();

/**
 * Expand tilde (~) in file paths to user home directory
 * Works cross-platform (macOS, Linux, Windows)
 */
function expandTilde(filepath?: string): string | undefined {
  if (!filepath) return undefined;
  
  return filepath.startsWith('~/')
    ? filepath.replace('~', homedir())
    : filepath;
}

/**
 * Resolve SSH configuration from tool arguments
 * 
 * Priority:
 * 1. Profile name in args.profile
 * 2. Default profile from DOCKER_PROFILES
 * 
 * @param args Tool arguments containing profile
 * @returns SSH configuration or null for local mode
 * @throws Error if specified profile is not found
 * 
 * @example Using profile name
 * ```typescript
 * resolveSSHConfig({ profile: "production" })
 * ```
 * 
 * @example Using default profile
 * ```typescript
 * resolveSSHConfig({}) // Uses default from DOCKER_PROFILES
 * ```
 */
export function resolveSSHConfig(args: {
  profile?: string;
}): SSHConfig | null {
  // Priority 1: Profile name specified
  if (args.profile) {
    const profileData = PROFILES.profiles[args.profile];
    
    if (!profileData) {
      const available = Object.keys(PROFILES.profiles).join(', ');
      throw new Error(
        `Profile "${args.profile}" not found in DOCKER_PROFILES. ` +
        `Available profiles: ${available}`
      );
    }
    
    // Check if profile is local mode
    if (profileData.mode === 'local') {
      logger.debug(`Profile "${args.profile}" is configured for LOCAL mode`);
      return null;
    }
    
    // Validate required fields for SSH
    if (!profileData.host || !profileData.username) {
      throw new Error(`Profile "${args.profile}" must have "host" and "username" fields for SSH mode`);
    }
    
    logger.debug(`Using profile: ${args.profile}`);
    const expandedKeyPath = expandTilde(profileData.privateKeyPath);
    if (profileData.privateKeyPath && expandedKeyPath !== profileData.privateKeyPath) {
      logger.debug(`Expanded privateKeyPath: ${profileData.privateKeyPath} → ${expandedKeyPath}`);
    }
    return {
      host: profileData.host,
      username: profileData.username,
      port: profileData.port || 22,
      privateKeyPath: expandedKeyPath,
      passphrase: profileData.passphrase,
      password: profileData.password,
      projectsPath: profileData.projectsPath
    };
  }
  
  // Priority 2: Default profile
  const defaultProfileName = PROFILES.default;
  const defaultProfileData = PROFILES.profiles[defaultProfileName];
  
  // Check if default profile is local mode
  if (defaultProfileData.mode === 'local') {
    logger.debug(`Default profile "${defaultProfileName}" is configured for LOCAL mode`);
    return null;
  }
  
  // Validate required fields for SSH
  if (!defaultProfileData.host || !defaultProfileData.username) {
    logger.warn(`Default profile "${defaultProfileName}" missing host/username, using local Docker`);
    return null;
  }
  
  logger.debug(`Using default profile: ${defaultProfileName}`);
  const expandedKeyPath = expandTilde(defaultProfileData.privateKeyPath);
  if (defaultProfileData.privateKeyPath && expandedKeyPath !== defaultProfileData.privateKeyPath) {
    logger.debug(`Expanded privateKeyPath: ${defaultProfileData.privateKeyPath} → ${expandedKeyPath}`);
  }
  return {
    host: defaultProfileData.host,
    username: defaultProfileData.username,
    port: defaultProfileData.port || 22,
    privateKeyPath: expandedKeyPath,
    passphrase: defaultProfileData.passphrase,
    password: defaultProfileData.password,
    projectsPath: defaultProfileData.projectsPath
  };
}

/**
 * Get list of available profile names
 * Useful for debugging and error messages
 */
export function getAvailableProfiles(): string[] {
  return Object.keys(PROFILES.profiles);
}

/**
 * Get default profile name
 */
export function getDefaultProfile(): string {
  return PROFILES.default;
}
