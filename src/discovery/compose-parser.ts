/**
 * YAML Parser для docker-compose.yml
 */

import { readFileSync } from 'fs';
import { dirname, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import { logger } from '../utils/logger.js';
import type { ProjectConfig, ServiceConfig } from './types.js';

export class ComposeParser {
  /**
   * Парсит docker-compose.yml
   */
  parse(composeFile: string): ProjectConfig {
    logger.debug(`Parsing compose file: ${composeFile}`);

    try {
      const content = readFileSync(composeFile, 'utf-8');
      const parsed = parseYaml(content);

      if (!parsed || !parsed.services) {
        throw new Error('Invalid docker-compose.yml: missing services');
      }

      const projectDir = dirname(composeFile);
      const projectName = this.extractProjectName(composeFile, parsed);

      return {
        name: projectName,
        composeFile,
        projectDir,
        services: this.parseServices(parsed.services),
      };
    } catch (error: any) {
      logger.error('Failed to parse compose file:', error);
      throw new Error(`Failed to parse ${composeFile}: ${error.message}`);
    }
  }

  /**
   * Извлекает имя проекта
   */
  private extractProjectName(composeFile: string, parsed: any): string {
    // 1. Из parsed.name (Compose v2)
    if (parsed.name) return parsed.name;

    // 2. Из имени директории
    const dir = dirname(composeFile);
    return basename(dir);
  }

  /**
   * Парсит секцию services
   */
  private parseServices(services: Record<string, any>): Record<string, ServiceConfig> {
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
   * Парсит ports (может быть array строк или объектов)
   */
  private parsePorts(ports: any): string[] | undefined {
    if (!ports) return undefined;

    if (Array.isArray(ports)) {
      return ports.map((port) => {
        if (typeof port === 'string') {
          return port;
        }
        // Object format: "8000:8000"
        if (port.published && port.target) {
          return `${port.published}:${port.target}`;
        }
        return String(port);
      });
    }

    return undefined;
  }

  /**
   * Парсит environment (может быть array или object)
   */
  private parseEnvironment(env: any): Record<string, string> | undefined {
    if (!env) return undefined;

    if (Array.isArray(env)) {
      // ["KEY=value", "KEY2=value2"]
      const result: Record<string, string> = {};
      for (const item of env) {
        const [key, ...valueParts] = item.split('=');
        if (key) {
          result[key] = valueParts.join('=');
        }
      }
      return result;
    }

    // {KEY: "value", KEY2: "value2"}
    return env;
  }

  /**
   * Определяет тип сервиса по image
   */
  private detectServiceType(config: any): ServiceConfig['type'] {
    const image = (config.image || '').toLowerCase();

    if (image.includes('postgres')) return 'postgresql';
    if (image.includes('redis')) return 'redis';
    if (image.includes('mysql')) return 'mysql';
    if (image.includes('mongo')) return 'mongodb';
    if (image.includes('sqlite')) return 'sqlite';

    return 'generic';
  }
}