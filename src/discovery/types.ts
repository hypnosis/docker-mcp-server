/**
 * Типы для Project Discovery
 * Конфигурация проекта из docker-compose.yml
 */

/**
 * Конфигурация проекта (из docker-compose.yml)
 */
export interface ProjectConfig {
  /** Имя проекта */
  name: string;
  
  /** Путь к docker-compose.yml */
  composeFile: string;
  
  /** Директория проекта */
  projectDir: string;
  
  /** Сервисы из compose file */
  services: Record<string, ServiceConfig>;
}

/**
 * Конфигурация сервиса
 */
export interface ServiceConfig {
  /** Имя сервиса (ключ из docker-compose.yml) */
  name: string;
  
  /** Docker image */
  image?: string;
  
  /** Build config */
  build?: {
    context: string;
    dockerfile?: string;
  };
  
  /** Порты */
  ports?: string[];
  
  /** Environment variables */
  environment?: Record<string, string>;
  
  /** Тип сервиса (для database adapters в Sprint 2) */
  type: 'generic' | 'postgresql' | 'redis' | 'sqlite' | 'mysql' | 'mongodb';
}

/**
 * Опции для discovery
 */
export interface DiscoveryOptions {
  /** Рабочая директория (откуда начинать поиск) */
  cwd?: string;
  
  /** Explicit path к compose file */
  explicitPath?: string;
}