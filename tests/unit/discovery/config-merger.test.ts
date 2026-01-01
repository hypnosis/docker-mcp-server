/**
 * Tests for ConfigMerger
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigMerger } from '../../../src/discovery/config-merger.js';

describe('ConfigMerger', () => {
  let merger: ConfigMerger;

  beforeEach(() => {
    merger = new ConfigMerger();
  });

  describe('merge', () => {
    it('should return empty object for empty array', () => {
      const result = merger.merge([]);
      expect(result).toEqual({});
    });

    it('should return single config as-is', () => {
      const config = {
        services: {
          web: {
            image: 'node:18',
          },
        },
      };

      const result = merger.merge([config]);
      expect(result).toEqual(config);
    });

    it('should merge objects recursively', () => {
      const base = {
        services: {
          web: {
            image: 'node:18',
            ports: ['3000:3000'],
          },
        },
      };

      const override = {
        services: {
          web: {
            environment: {
              NODE_ENV: 'production',
            },
          },
        },
      };

      const result = merger.merge([base, override]);

      expect(result.services.web.image).toBe('node:18');
      expect(result.services.web.ports).toEqual(['3000:3000']);
      expect(result.services.web.environment).toEqual({
        NODE_ENV: 'production',
      });
    });

    it('should concatenate arrays (ports, volumes, depends_on)', () => {
      const base = {
        services: {
          web: {
            ports: ['3000:3000'],
            volumes: ['./app:/app'],
          },
        },
      };

      const override = {
        services: {
          web: {
            ports: ['3001:3001'],
            volumes: ['./config:/config'],
          },
        },
      };

      const result = merger.merge([base, override]);

      expect(result.services.web.ports).toEqual(['3000:3000', '3001:3001']);
      expect(result.services.web.volumes).toEqual(['./app:/app', './config:/config']);
    });

    it('should override primitives (last wins)', () => {
      const base = {
        services: {
          web: {
            image: 'node:16',
            restart: 'always',
          },
        },
      };

      const override = {
        services: {
          web: {
            image: 'node:18',
            restart: 'unless-stopped',
          },
        },
      };

      const result = merger.merge([base, override]);

      expect(result.services.web.image).toBe('node:18');
      expect(result.services.web.restart).toBe('unless-stopped');
    });

    it('should handle multiple configs', () => {
      const config1 = {
        services: {
          web: { image: 'node:16' },
        },
      };

      const config2 = {
        services: {
          web: { ports: ['3000:3000'] },
          db: { image: 'postgres:15' },
        },
      };

      const config3 = {
        services: {
          web: { image: 'node:18' },
        },
      };

      const result = merger.merge([config1, config2, config3]);

      expect(result.services.web.image).toBe('node:18'); // Last wins
      expect(result.services.web.ports).toEqual(['3000:3000']);
      expect(result.services.db.image).toBe('postgres:15');
    });

    it('should handle null and undefined values', () => {
      const base = {
        services: {
          web: {
            image: 'node:18',
            environment: null,
          },
        },
      };

      const override = {
        services: {
          web: {
            environment: {
              NODE_ENV: 'production',
            },
          },
        },
      };

      const result = merger.merge([base, override]);

      expect(result.services.web.image).toBe('node:18');
      expect(result.services.web.environment).toEqual({
        NODE_ENV: 'production',
      });
    });

    it('should handle nested objects', () => {
      const base = {
        services: {
          web: {
            build: {
              context: '.',
              dockerfile: 'Dockerfile',
            },
          },
        },
      };

      const override = {
        services: {
          web: {
            build: {
              args: {
                NODE_ENV: 'production',
              },
            },
          },
        },
      };

      const result = merger.merge([base, override]);

      expect(result.services.web.build.context).toBe('.');
      expect(result.services.web.build.dockerfile).toBe('Dockerfile');
      expect(result.services.web.build.args).toEqual({
        NODE_ENV: 'production',
      });
    });

    it('should handle mixed array and non-array types', () => {
      const base = {
        services: {
          web: {
            ports: ['3000:3000'],
          },
        },
      };

      const override = {
        services: {
          web: {
            ports: '3001:3001', // String instead of array
          },
        },
      };

      const result = merger.merge([base, override]);

      // Source (override) should win when types don't match
      expect(result.services.web.ports).toBe('3001:3001');
    });

    it('should merge volumes correctly', () => {
      const base = {
        services: {
          web: {
            volumes: ['volume1', 'volume2'],
          },
        },
      };

      const override = {
        services: {
          web: {
            volumes: ['volume3'],
          },
        },
      };

      const result = merger.merge([base, override]);

      expect(result.services.web.volumes).toEqual(['volume1', 'volume2', 'volume3']);
    });

    it('should merge depends_on correctly', () => {
      const base = {
        services: {
          web: {
            depends_on: ['db'],
          },
        },
      };

      const override = {
        services: {
          web: {
            depends_on: ['redis'],
          },
        },
      };

      const result = merger.merge([base, override]);

      expect(result.services.web.depends_on).toEqual(['db', 'redis']);
    });
  });
});

