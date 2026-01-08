/**
 * Project Discovery
 * Автоматическое обнаружение и парсинг docker-compose.yml
 */

import { existsSync } from 'fs';
import { dirname, join, basename } from 'path';
import { logger } from '../utils/logger.js';
import { workspaceManager } from '../utils/workspace.js';
import { projectConfigCache } from '../utils/cache.js';
import { ComposeParser } from './compose-parser.js';
import { ConfigMerger } from './config-merger.js';
import type { ProjectConfig, DiscoveryOptions, ServiceConfig } from './types.js';

export class ProjectDiscovery {
  private readonly COMPOSE_FILENAMES = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
  ];

  private parser: ComposeParser;
  private merger: ConfigMerger;

  constructor() {
    this.parser = new ComposeParser();
    this.merger = new ConfigMerger();
  }

  /**
   * Находит и парсит docker-compose проект
   */
  async findProject(options: DiscoveryOptions = {}): Promise<ProjectConfig> {
    logger.debug('Starting project discovery', options);

    // Если передан явный project name, возвращаем минимальный конфиг
    // Это для случаев когда работаем с remote и compose файла нет локально
    if (options.explicitProjectName) {
      logger.debug(`Using explicit project name: ${options.explicitProjectName}`);
      return {
        name: options.explicitProjectName,
        composeFile: '', // Не известно для remote без compose файла
        projectDir: '',  // Не известно для remote без compose файла
        services: {},    // Будет заполнено через Docker API
      };
    }

    // Генерируем ключ кеша
    const cacheKey = this.getCacheKey(options);

    // Проверяем кеш
    const cached = projectConfigCache.get(cacheKey);
    if (cached) {
      logger.debug('Using cached project config');
      return cached;
    }

    try {
      let config: ProjectConfig;

      // Explicit path имеет приоритет (используем только его, без merge)
      if (options.explicitPath) {
        if (!existsSync(options.explicitPath)) {
          throw new Error(`Compose file not found: ${options.explicitPath}`);
        }
        config = await this.loadProject(options.explicitPath);
      } else {
        // Auto-detect multiple compose files
        // Используем workspace root от MCP клиента или fallback на process.cwd()
        const cwd = options.cwd || workspaceManager.getWorkspaceRoot() || process.cwd();
        const composeFiles = this.autoDetectFiles(cwd);

        if (composeFiles.length === 0) {
          const workspaceInfo = workspaceManager.hasWorkspaceRoot() 
            ? 'MCP workspace root' 
            : 'process.cwd() (MCP workspace root not available)';
          
          // Предлагаем возможные решения
          const suggestions = [
            'Make sure you are in a directory with docker-compose.yml',
            'Or specify the project path explicitly',
            'Supported filenames: docker-compose.yml, docker-compose.yaml, compose.yml, compose.yaml'
          ];
          
          throw new Error(
            'docker-compose.yml not found. Please run from project directory.\n' +
            'Searched directories:\n' +
            `  ${cwd} (${workspaceInfo}) (and parent directories)\n\n` +
            'Suggestions:\n' +
            suggestions.map(s => `  - ${s}`).join('\n')
          );
        }

        config = await this.loadProject(composeFiles);
      }

      // Сохраняем в кеш
      projectConfigCache.set(cacheKey, config);

      return config;
    } catch (error: any) {
      // При ошибке инвалидируем кеш
      projectConfigCache.invalidate(cacheKey);
      logger.error('Project discovery failed, cache invalidated:', error);
      throw error;
    }
  }

  /**
   * Генерирует ключ кеша для опций discovery
   */
  private getCacheKey(options: DiscoveryOptions): string {
    if (options.explicitPath) {
      return `project:${options.explicitPath}`;
    }

    // Используем workspace root от MCP клиента или fallback на process.cwd()
    const cwd = options.cwd || workspaceManager.getWorkspaceRoot() || process.cwd();
    return `project:${cwd}`;
  }

  /**
   * Рекурсивный поиск вверх по дереву
   */
  private findComposeFile(startDir: string): string | null {
    let currentDir = startDir;

    // Защита от бесконечного цикла
    const visited = new Set<string>();

    while (currentDir && currentDir !== '/' && !visited.has(currentDir)) {
      visited.add(currentDir);

      // Проверяем все варианты имени файла
      for (const filename of this.COMPOSE_FILENAMES) {
        const fullPath = join(currentDir, filename);
        if (existsSync(fullPath)) {
          logger.info(`Found compose file: ${fullPath}`);
          return fullPath;
        }
      }

      // Поднимаемся на уровень вверх
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) break; // Достигли root
      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Auto-detect compose файлов (base + env + override)
   */
  private autoDetectFiles(cwd: string): string[] {
    const files: string[] = [];
    const projectDir = this.findComposeFile(cwd);
    
    if (!projectDir) {
      return [];
    }

    const dir = dirname(projectDir);

    // 1. Base file (docker-compose.yml)
    const baseFile = join(dir, 'docker-compose.yml');
    if (existsSync(baseFile)) {
      files.push(baseFile);
      logger.debug(`Found base file: ${baseFile}`);
    }

    // 2. Environment-specific file (docker-compose.{env}.yml)
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv) {
      const envFile = join(dir, `docker-compose.${nodeEnv}.yml`);
      if (existsSync(envFile)) {
        files.push(envFile);
        logger.debug(`Found environment file: ${envFile}`);
      }
    }

    // 3. Override file (docker-compose.override.yml) - всегда последний
    const overrideFile = join(dir, 'docker-compose.override.yml');
    if (existsSync(overrideFile)) {
      files.push(overrideFile);
      logger.debug(`Found override file: ${overrideFile}`);
    }

    return files;
  }

  /**
   * Загружает и парсит compose file(s)
   * Поддерживает как один файл, так и несколько (для merge)
   */
  private async loadProject(composeFiles: string | string[]): Promise<ProjectConfig> {
    const files = Array.isArray(composeFiles) ? composeFiles : [composeFiles];
    
    if (files.length === 0) {
      throw new Error('No compose files provided');
    }

    logger.debug(`Loading project from ${files.length} file(s):`, files);

    // Если один файл → просто парсим
    if (files.length === 1) {
      return this.parser.parse(files[0]);
    }

    // Несколько файлов → парсим каждый и мержим
    const parsedConfigs = files.map(file => {
      return this.parser.parseRaw(file);
    });

    // Мержим конфиги
    const mergedConfig = this.merger.merge(parsedConfigs);

    // Используем первый файл как базовый для определения projectDir и name
    const baseFile = files[0];
    const projectDir = dirname(baseFile);
    const projectName = this.extractProjectName(baseFile, mergedConfig);

    // Парсим merged config в ProjectConfig
    return {
      name: projectName,
      composeFile: baseFile, // Используем первый файл как основной
      projectDir,
      services: this.parseServices(mergedConfig.services || {}),
    };
  }

  /**
   * Извлекает имя проекта из конфига
   */
  private extractProjectName(composeFile: string, parsed: any): string {
    // 1. Из parsed.name (Compose v2)
    if (parsed.name) return parsed.name;

    // 2. Из имени директории
    const dir = dirname(composeFile);
    return basename(dir);
  }

  /**
   * Парсит секцию services (из merged config)
   */
  private parseServices(services: Record<string, any>): Record<string, ServiceConfig> {
    // Используем логику из ComposeParser
    const result: Record<string, ServiceConfig> = {};

    for (const [name, config] of Object.entries(services)) {
      result[name] = {
        name,
        image: config.image,
        build: config.build,
        ports: this.parsePorts(config.ports),
        environment: this.parseEnvironment(config.environment),
        type: this.detectServiceType(config),
      };
    }

    return result;
  }

  /**
   * Парсит ports
   */
  private parsePorts(ports: any): string[] | undefined {
    if (!ports) return undefined;

    if (Array.isArray(ports)) {
      return ports.map((port: any) => {
        if (typeof port === 'string') {
          return port;
        }
        if (port.published && port.target) {
          return `${port.published}:${port.target}`;
        }
        return String(port);
      });
    }

    return undefined;
  }

  /**
   * Парсит environment
   */
  private parseEnvironment(env: any): Record<string, string> | undefined {
    if (!env) return undefined;

    if (Array.isArray(env)) {
      const result: Record<string, string> = {};
      for (const item of env) {
        const [key, ...valueParts] = item.split('=');
        if (key) {
          result[key] = valueParts.join('=');
        }
      }
      return result;
    }

    return env;
  }

  /**
   * Определяет тип сервиса
   */
  private detectServiceType(config: any): 'generic' | 'postgresql' | 'redis' | 'sqlite' | 'mysql' | 'mongodb' {
    const image = (config.image || '').toLowerCase();

    if (image.includes('postgres')) return 'postgresql';
    if (image.includes('redis')) return 'redis';
    if (image.includes('mysql')) return 'mysql';
    if (image.includes('mongo')) return 'mongodb';
    if (image.includes('sqlite')) return 'sqlite';

    return 'generic';
  }
}