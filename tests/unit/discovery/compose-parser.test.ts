/**
 * Tests for ComposeParser
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComposeParser } from '../../../src/discovery/compose-parser.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('ComposeParser', () => {
  let parser: ComposeParser;
  let tempDir: string;

  beforeEach(() => {
    parser = new ComposeParser();
    tempDir = mkdtempSync(join(tmpdir(), 'compose-parser-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('parseRaw', () => {
    it('should parse valid YAML file', () => {
      const yamlContent = `
services:
  web:
    image: node:18
    ports:
      - "3000:3000"
`;
      const composeFile = join(tempDir, 'docker-compose.yml');
      writeFileSync(composeFile, yamlContent);

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parseRaw(composeFile);

      expect(result.services).toBeDefined();
      expect(result.services.web.image).toBe('node:18');
      expect(readFileSync).toHaveBeenCalledWith(composeFile, 'utf-8');
    });

    it('should handle invalid YAML gracefully', () => {
      const invalidYaml = 'invalid: yaml: content: [';
      const composeFile = join(tempDir, 'invalid.yml');

      vi.mocked(readFileSync).mockReturnValue(invalidYaml);

      expect(() => parser.parseRaw(composeFile)).toThrow();
    });
  });

  describe('parse', () => {
    it('should parse valid compose file', () => {
      const yamlContent = `
services:
  web:
    image: node:18
    ports:
      - "3000:3000"
`;
      const composeFile = join(tempDir, 'docker-compose.yml');
      writeFileSync(composeFile, yamlContent);

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.name).toBe(basename(dirname(composeFile)));
      expect(result.composeFile).toBe(composeFile);
      expect(result.projectDir).toBe(dirname(composeFile));
      expect(result.services.web).toBeDefined();
      expect(result.services.web.image).toBe('node:18');
    });

    it('should extract project name from parsed.name (Compose v2)', () => {
      const yamlContent = `
name: my-project
services:
  web:
    image: node:18
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.name).toBe('my-project');
    });

    it('should use directory name when parsed.name is not available', () => {
      const yamlContent = `
services:
  web:
    image: node:18
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.name).toBe(basename(tempDir));
    });

    it('should throw error when services are missing', () => {
      const yamlContent = 'version: "3"';
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      expect(() => parser.parse(composeFile)).toThrow('Invalid docker-compose.yml: missing services');
    });

    it('should parse ports as array of strings', () => {
      const yamlContent = `
services:
  web:
    image: node:18
    ports:
      - "3000:3000"
      - "3001:3001"
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.services.web.ports).toEqual(['3000:3000', '3001:3001']);
    });

    it('should parse ports as array of objects', () => {
      const yamlContent = `
services:
  web:
    image: node:18
    ports:
      - published: 3000
        target: 3000
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.services.web.ports).toEqual(['3000:3000']);
    });

    it('should parse environment as object', () => {
      const yamlContent = `
services:
  web:
    image: node:18
    environment:
      NODE_ENV: production
      PORT: "3000"
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.services.web.environment).toEqual({
        NODE_ENV: 'production',
        PORT: '3000',
      });
    });

    it('should parse environment as array', () => {
      const yamlContent = `
services:
  web:
    image: node:18
    environment:
      - NODE_ENV=production
      - PORT=3000
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.services.web.environment).toEqual({
        NODE_ENV: 'production',
        PORT: '3000',
      });
    });

    it('should detect service types correctly', () => {
      const yamlContent = `
services:
  postgres:
    image: postgres:15
  redis:
    image: redis:7
  mysql:
    image: mysql:8
  mongo:
    image: mongo:6
  sqlite:
    image: sqlite:latest
  web:
    image: node:18
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.services.postgres.type).toBe('postgresql');
      expect(result.services.redis.type).toBe('redis');
      expect(result.services.mysql.type).toBe('mysql');
      expect(result.services.mongo.type).toBe('mongodb');
      expect(result.services.sqlite.type).toBe('sqlite');
      expect(result.services.web.type).toBe('generic');
    });

    it('should handle build config', () => {
      const yamlContent = `
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.services.web.build).toEqual({
        context: '.',
        dockerfile: 'Dockerfile',
      });
    });

    it('should handle missing optional fields', () => {
      const yamlContent = `
services:
  web:
    image: node:18
`;
      const composeFile = join(tempDir, 'docker-compose.yml');

      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = parser.parse(composeFile);

      expect(result.services.web.ports).toBeUndefined();
      expect(result.services.web.environment).toBeUndefined();
      expect(result.services.web.build).toBeUndefined();
    });
  });
});

// Helper functions
function basename(path: string): string {
  return path.split('/').pop() || path.split('\\').pop() || path;
}

