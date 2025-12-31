/**
 * Project Discovery
 * Автоматическое обнаружение и парсинг docker-compose.yml
 */

import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from '../utils/logger.js';
import { ComposeParser } from './compose-parser.js';
import type { ProjectConfig, DiscoveryOptions } from './types.js';

export class ProjectDiscovery {
  private readonly COMPOSE_FILENAMES = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
  ];

  private parser: ComposeParser;

  constructor() {
    this.parser = new ComposeParser();
  }

  /**
   * Находит и парсит docker-compose проект
   */
  async findProject(options: DiscoveryOptions = {}): Promise<ProjectConfig> {
    logger.debug('Starting project discovery', options);

    // Explicit path имеет приоритет
    if (options.explicitPath) {
      if (!existsSync(options.explicitPath)) {
        throw new Error(`Compose file not found: ${options.explicitPath}`);
      }
      return this.loadProject(options.explicitPath);
    }

    // Recursive search
    const cwd = options.cwd || process.cwd();
    const composeFile = this.findComposeFile(cwd);

    if (!composeFile) {
      throw new Error(
        'docker-compose.yml not found. Please run from project directory.\n' +
        'Searched directories:\n' +
        `  ${cwd} (and parent directories)`
      );
    }

    return this.loadProject(composeFile);
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
   * Загружает и парсит compose file
   */
  private async loadProject(composeFile: string): Promise<ProjectConfig> {
    logger.debug(`Loading project from: ${composeFile}`);
    return this.parser.parse(composeFile);
  }
}