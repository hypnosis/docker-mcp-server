/**
 * YAML Parser для docker-compose.yml
 */

import { readFileSync } from 'fs';
import { dirname, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import type { ProjectConfig, ServiceConfig } from './types.js';

export class ComposeParser {
  /**
   * Парсит docker-compose.yml
   */
  parse(composeFile: string): ProjectConfig {
    try {
      const parsed = this.parseRaw(composeFile);

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
      throw new Error(`Failed to parse ${composeFile}: ${error.message}`);
    }
  }

  /**
   * Парсит raw YAML (для merge нескольких файлов)
   */
  parseRaw(composeFile: string): any {
    const content = readFileSync(composeFile, 'utf-8');
    return parseYaml(content);
  }

  /**
   * Парсит docker-compose.yml из строки (для remote files)
   */
  parseFromString(composeContent: string, composeFilePath: string): ProjectConfig {
    try {
      const parsed = parseYaml(composeContent);

      if (!parsed || !parsed.services) {
        throw new Error('Invalid docker-compose.yml: missing services');
      }

      const projectDir = dirname(composeFilePath);
      const projectName = this.extractProjectName(composeFilePath, parsed);

      return {
        name: projectName,
        composeFile: composeFilePath,
        projectDir,
        services: this.parseServices(parsed.services),
      };
    } catch (error: any) {
      throw new Error(`Failed to parse ${composeFilePath}: ${error.message}`);
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
        working_dir: config.working_dir || config.workingDir,
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

    // PostgreSQL variants: postgres, postgresql, pgvector, timescaledb, postgis
    if (image.includes('postgres') || image.includes('pgvector') || image.includes('timescale') || image.includes('postgis')) {
      return 'postgresql';
    }
    
    if (image.includes('redis')) return 'redis';
    if (image.includes('mysql') || image.includes('mariadb')) return 'mysql';
    if (image.includes('mongo')) return 'mongodb';
    if (image.includes('sqlite')) return 'sqlite';

    return 'generic';
  }
}