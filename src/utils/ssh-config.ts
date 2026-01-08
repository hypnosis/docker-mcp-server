/**
 * SSH Configuration Module
 * SSH configuration management for remote Docker
 */

import { existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { logger } from './logger.js';
import { loadProfilesFile, profileDataToSSHConfig } from './profiles-file.js';

/**
 * SSH configuration for connecting to remote Docker server
 */
export interface SSHConfig {
  /** Server address (IP or domain name) */
  host: string;
  /** SSH port (default: 22) */
  port?: number;
  /** Username for SSH connection */
  username: string;
  /** Path to private SSH key */
  privateKeyPath?: string;
  /** Passphrase for encrypted SSH key */
  passphrase?: string;
  /** Password for authentication (not recommended for production) */
  password?: string;
  /** Base path for Docker projects on remote server (e.g., "/var/www") */
  projectsPath?: string;
}

/**
 * SSH profile with name and configuration
 * Allows working with multiple servers
 */
export interface SSHProfile {
  /** Profile name (e.g., 'production', 'staging') */
  name: string;
  /** SSH configuration */
  config: SSHConfig;
}

/**
 * SSH configuration loading result
 */
export interface SSHConfigResult {
  /** SSH configuration or null if not found */
  config: SSHConfig | null;
  /** Validation errors (if any) */
  errors: string[];
}

/**
 * SSH profiles loading result
 */
export interface SSHProfilesResult {
  /** Profiles or empty object if not found */
  profiles: Record<string, SSHConfig>;
  /** Validation errors (if any) */
  errors: string[];
}

/**
 * Валидация SSH конфигурации
 * @param config - SSH конфигурация для проверки
 * @returns Массив ошибок (пустой, если валидация прошла успешно)
 */
export function validateSSHConfig(config: Partial<SSHConfig>): string[] {
  const errors: string[] = [];

  // host обязателен
  if (!config.host || typeof config.host !== 'string' || config.host.trim().length === 0) {
    errors.push('SSH host is required and must be a non-empty string');
  }

  // username обязателен
  if (!config.username || typeof config.username !== 'string' || config.username.trim().length === 0) {
    errors.push('SSH username is required and must be a non-empty string');
  }

  // port должен быть валидным числом (если указан)
  if (config.port !== undefined) {
    if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
      errors.push('SSH port must be a number between 1 and 65535');
    }
  }

  // privateKeyPath должен быть валидным путем (если указан)
  if (config.privateKeyPath !== undefined) {
    if (typeof config.privateKeyPath !== 'string' || config.privateKeyPath.trim().length === 0) {
      errors.push('SSH privateKeyPath must be a non-empty string');
    } else {
      // Проверка на directory traversal
      const resolvedPath = resolve(config.privateKeyPath);
      if (!isAbsolute(resolvedPath) && !config.privateKeyPath.startsWith('~')) {
        errors.push('SSH privateKeyPath must be an absolute path or start with ~');
      }
    }
  }

  // Если не указан ни ключ, ни пароль - это предупреждение (но не ошибка)
  if (!config.privateKeyPath && !config.password) {
    logger.warn('SSH config: neither privateKeyPath nor password specified. Authentication may fail.');
  }

  return errors;
}

/**
 * Load SSH configuration from environment variables or profiles file
 * 
 * Priority order:
 * 1. DOCKER_MCP_PROFILES_FILE - Load from JSON file
 * 2. DOCKER_SSH_PROFILE + DOCKER_SSH_PROFILES - Load from env JSON
 * 3. DOCKER_SSH_HOST + DOCKER_SSH_USER - Simple single server config
 * 
 * @param env - Environment variables object (defaults to process.env)
 * @param profileName - Optional profile name to load (overrides DOCKER_SSH_PROFILE)
 * @returns SSH configuration result with config and errors
 */
export function loadSSHConfig(
  env: Record<string, string | undefined> = process.env,
  profileName?: string
): SSHConfigResult {
  const errors: string[] = [];

  // Priority 1: Load from profiles file (with graceful fallback if file doesn't exist)
  const profilesFile = env.DOCKER_MCP_PROFILES_FILE;
  if (profilesFile) {
    const fileResult = loadSSHConfigFromFile(profilesFile, profileName || env.DOCKER_SSH_PROFILE, env);
    
    // If file not found or empty, fallback gracefully (not an error for local-only users)
    if (fileResult.errors.length > 0 && !fileResult.config) {
      const fileNotFound = fileResult.errors.some(e => e.includes('not found'));
      if (fileNotFound) {
        logger.debug(`Profiles file not found: ${profilesFile}. Falling back to local Docker.`);
        // Continue to next priority (env vars or local)
      } else {
        // Other errors (invalid JSON, etc.) - log but still allow fallback
        logger.warn(`Profiles file errors: ${fileResult.errors.join(', ')}. Falling back to local Docker.`);
      }
      // Continue to check env vars or local Docker
    } else if (fileResult.config) {
      // Successfully loaded from file
      return fileResult;
    }
    // If config is null, continue to next priority
  }

  // Priority 2: Check for active profile in env
  const activeProfile = profileName || env.DOCKER_SSH_PROFILE;
  if (activeProfile) {
    // Load profiles from env JSON and use active profile
    const profilesResult = loadSSHProfiles(env);
    errors.push(...profilesResult.errors);

    if (profilesResult.profiles[activeProfile]) {
      const config = profilesResult.profiles[activeProfile];
      const validationErrors = validateSSHConfig(config);
      errors.push(...validationErrors);

      if (errors.length === 0) {
        logger.info(`SSH config loaded from profile: ${activeProfile}`);
        return { config, errors: [] };
      }

      return { config: null, errors };
    } else {
      errors.push(`SSH profile "${activeProfile}" not found in DOCKER_SSH_PROFILES`);
      return { config: null, errors };
    }
  }

  // Простой вариант: загрузка из DOCKER_SSH_* переменных
  const host = env.DOCKER_SSH_HOST;
  const username = env.DOCKER_SSH_USER || env.DOCKER_SSH_USERNAME;

  // Если нет базовых переменных, возвращаем null (не ошибка - SSH может быть не нужен)
  if (!host && !username) {
    logger.debug('No SSH configuration found in environment variables');
    return { config: null, errors: [] };
  }

  // Собираем конфигурацию
  const config: Partial<SSHConfig> = {};

  if (host) {
    config.host = host.trim();
  }

  if (username) {
    config.username = username.trim();
  }

  // Порт (по умолчанию 22)
  if (env.DOCKER_SSH_PORT) {
    const port = parseInt(env.DOCKER_SSH_PORT, 10);
    if (!isNaN(port)) {
      config.port = port;
    } else {
      errors.push(`Invalid DOCKER_SSH_PORT value: ${env.DOCKER_SSH_PORT}`);
    }
  } else {
    config.port = 22; // Значение по умолчанию
  }

  // Путь к приватному ключу
  if (env.DOCKER_SSH_KEY || env.DOCKER_SSH_PRIVATE_KEY || env.DOCKER_SSH_KEY_PATH) {
    const keyPath = env.DOCKER_SSH_KEY || env.DOCKER_SSH_PRIVATE_KEY || env.DOCKER_SSH_KEY_PATH;
    if (keyPath) {
      config.privateKeyPath = keyPath.trim();
    }
  }

  // Пароль для зашифрованного ключа
  if (env.DOCKER_SSH_PASSPHRASE) {
    config.passphrase = env.DOCKER_SSH_PASSPHRASE;
  }

  // Пароль для аутентификации
  if (env.DOCKER_SSH_PASSWORD) {
    config.password = env.DOCKER_SSH_PASSWORD;
  }

  // Валидация
  const validationErrors = validateSSHConfig(config);
  errors.push(...validationErrors);

  if (errors.length > 0) {
    logger.error('SSH config validation errors:', errors);
    return { config: null, errors };
  }

  logger.info('SSH config loaded from environment variables');
  return { config: config as SSHConfig, errors: [] };
}

/**
 * Загрузить SSH профили из environment variables
 * 
 * Формат DOCKER_SSH_PROFILES: JSON объект
 * {
 *   "profile1": {
 *     "host": "server1.com",
 *     "username": "user1",
 *     "port": 22,
 *     "privateKeyPath": "/path/to/key1"
 *   },
 *   "profile2": {
 *     "host": "server2.com",
 *     "username": "user2"
 *   }
 * }
 * 
 * @param env - Объект с environment variables (по умолчанию process.env)
 * @returns Результат загрузки с профилями и ошибками
 */
export function loadSSHProfiles(env: Record<string, string | undefined> = process.env): SSHProfilesResult {
  const errors: string[] = [];
  const profiles: Record<string, SSHConfig> = {};

  const profilesJson = env.DOCKER_SSH_PROFILES;
  if (!profilesJson) {
    logger.debug('No DOCKER_SSH_PROFILES found in environment');
    return { profiles, errors: [] };
  }

  try {
    // Парсим JSON
    const parsed = JSON.parse(profilesJson);
    
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      errors.push('DOCKER_SSH_PROFILES must be a JSON object');
      return { profiles, errors };
    }

    // Обрабатываем каждый профиль
    for (const [profileName, profileData] of Object.entries(parsed)) {
      if (typeof profileData !== 'object' || profileData === null || Array.isArray(profileData)) {
        errors.push(`Profile "${profileName}" must be an object`);
        continue;
      }

      const profileConfig = profileData as Record<string, any>;
      
      // Собираем конфигурацию профиля
      const config: Partial<SSHConfig> = {};

      if (profileConfig.host && typeof profileConfig.host === 'string') {
        config.host = profileConfig.host.trim();
      }

      if (profileConfig.username && typeof profileConfig.username === 'string') {
        config.username = profileConfig.username.trim();
      }

      // Порт
      if (profileConfig.port !== undefined) {
        const port = typeof profileConfig.port === 'number' 
          ? profileConfig.port 
          : parseInt(String(profileConfig.port), 10);
        if (!isNaN(port)) {
          config.port = port;
        } else {
          errors.push(`Invalid port in profile "${profileName}": ${profileConfig.port}`);
        }
      } else {
        config.port = 22; // Значение по умолчанию
      }

      // Путь к ключу
      if (profileConfig.privateKeyPath && typeof profileConfig.privateKeyPath === 'string') {
        config.privateKeyPath = profileConfig.privateKeyPath.trim();
      } else if (profileConfig.key && typeof profileConfig.key === 'string') {
        config.privateKeyPath = profileConfig.key.trim();
      }

      // Passphrase
      if (profileConfig.passphrase && typeof profileConfig.passphrase === 'string') {
        config.passphrase = profileConfig.passphrase;
      }

      // Password
      if (profileConfig.password && typeof profileConfig.password === 'string') {
        config.password = profileConfig.password;
      }

      // Валидация профиля
      const validationErrors = validateSSHConfig(config);
      if (validationErrors.length > 0) {
        errors.push(`Profile "${profileName}" validation errors: ${validationErrors.join(', ')}`);
        continue;
      }

      profiles[profileName] = config as SSHConfig;
      logger.debug(`SSH profile "${profileName}" loaded successfully`);
    }

    if (errors.length === 0 && Object.keys(profiles).length > 0) {
      logger.info(`SSH profiles loaded: ${Object.keys(profiles).join(', ')}`);
    }

    return { profiles, errors };
  } catch (error: any) {
    errors.push(`Failed to parse DOCKER_SSH_PROFILES: ${error.message}`);
    return { profiles, errors };
  }
}

/**
 * Load SSH config from profiles file
 * 
 * @param filePath - Path to profiles JSON file
 * @param profileName - Profile name to load (uses default if not specified)
 * @param env - Environment variables for fallback
 * @returns SSH configuration result
 */
function loadSSHConfigFromFile(
  filePath: string,
  profileName: string | undefined,
  env: Record<string, string | undefined>
): SSHConfigResult {
  const errors: string[] = [];

  // Load profiles file
  const fileResult = loadProfilesFile(filePath);
  if (fileResult.errors.length > 0) {
    errors.push(...fileResult.errors);
    return { config: null, errors };
  }

  if (!fileResult.config) {
    errors.push(`Profiles file not found or empty: ${filePath}`);
    return { config: null, errors };
  }

  // Determine which profile to use
  const targetProfile = profileName || fileResult.config.default;
  
  if (!targetProfile) {
    errors.push('No profile specified and no default profile set in file');
    return { config: null, errors };
  }

  // Get profile data
  const profileData = fileResult.config.profiles[targetProfile];
  if (!profileData) {
    const available = Object.keys(fileResult.config.profiles).join(', ');
    errors.push(`Profile "${targetProfile}" not found. Available profiles: ${available}`);
    return { config: null, errors };
  }

  // Convert to SSHConfig
  const config = profileDataToSSHConfig(profileData);

  // Validate
  const validationErrors = validateSSHConfig(config);
  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
    return { config: null, errors };
  }

  logger.info(`SSH config loaded from file: ${filePath} (profile: ${targetProfile})`);
  return { config, errors: [] };
}

/**
 * Get active SSH profile name
 * @param env - Environment variables object
 * @returns Active profile name or null
 */
export function getActiveSSHProfile(env: Record<string, string | undefined> = process.env): string | null {
  return env.DOCKER_SSH_PROFILE || null;
}

/**
 * Проверить существование SSH ключа по пути
 * @param keyPath - Путь к SSH ключу
 * @returns true, если ключ существует
 */
export function checkSSHKeyExists(keyPath: string): boolean {
  try {
    // Обработка ~ в пути
    const resolvedPath = keyPath.startsWith('~')
      ? keyPath.replace('~', process.env.HOME || process.env.USERPROFILE || '')
      : resolve(keyPath);
    
    return existsSync(resolvedPath);
  } catch {
    return false;
  }
}

