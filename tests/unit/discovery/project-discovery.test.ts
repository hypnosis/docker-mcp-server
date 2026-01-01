/**
 * Tests for ProjectDiscovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectDiscovery } from '../../../src/discovery/project-discovery.js';
import type { ProjectConfig } from '../../../src/discovery/types.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { projectConfigCache } from '../../../src/utils/cache.js';

// Mock dependencies
const mockComposeParser = {
  parse: vi.fn(),
  parseRaw: vi.fn(),
};

const mockConfigMerger = {
  merge: vi.fn(),
};

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

vi.mock('../../../src/discovery/compose-parser.js', () => ({
  ComposeParser: class {
    parse = mockComposeParser.parse;
    parseRaw = mockComposeParser.parseRaw;
  },
}));

vi.mock('../../../src/discovery/config-merger.js', () => ({
  ConfigMerger: class {
    merge = mockConfigMerger.merge;
  },
}));

vi.mock('../../../src/utils/cache.js', () => ({
  projectConfigCache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('ProjectDiscovery', () => {
  let discovery: ProjectDiscovery;
  let originalCwd: string;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save original values
    originalCwd = process.cwd();
    originalNodeEnv = process.env.NODE_ENV;
    
    // Reset mocks
    mockComposeParser.parse.mockReset();
    mockComposeParser.parseRaw.mockReset();
    mockConfigMerger.merge.mockReset();
    vi.mocked(projectConfigCache.get).mockReturnValue(undefined);
    vi.mocked(projectConfigCache.set).mockImplementation(() => {});
    vi.mocked(projectConfigCache.invalidate).mockImplementation(() => {});
    
    vi.mocked(existsSync).mockReturnValue(false);
    
    discovery = new ProjectDiscovery();
  });

  afterEach(() => {
    // Restore original values
    process.cwd = () => originalCwd;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe('findProject', () => {
    it('should return cached config if available', async () => {
      const cachedConfig: ProjectConfig = {
        name: 'test-project',
        composeFile: '/test/docker-compose.yml',
        projectDir: '/test',
        services: {},
      };

      vi.mocked(projectConfigCache.get).mockReturnValue(cachedConfig);

      const result = await discovery.findProject();

      expect(result).toBe(cachedConfig);
      expect(projectConfigCache.get).toHaveBeenCalled();
      expect(mockComposeParser.parse).not.toHaveBeenCalled();
    });

    it('should use explicit path when provided', async () => {
      const explicitPath = '/custom/path/docker-compose.yml';
      const config: ProjectConfig = {
        name: 'custom-project',
        composeFile: explicitPath,
        projectDir: '/custom/path',
        services: {},
      };

      vi.mocked(existsSync).mockReturnValue(true);
      mockComposeParser.parse.mockReturnValue(config);

      const result = await discovery.findProject({ explicitPath });

      expect(result).toEqual(config);
      expect(existsSync).toHaveBeenCalledWith(explicitPath);
      expect(mockComposeParser.parse).toHaveBeenCalledWith(explicitPath);
      expect(projectConfigCache.set).toHaveBeenCalled();
    });

    it('should throw error if explicit path does not exist', async () => {
      const explicitPath = '/nonexistent/docker-compose.yml';

      vi.mocked(existsSync).mockReturnValue(false);

      await expect(discovery.findProject({ explicitPath })).rejects.toThrow(
        `Compose file not found: ${explicitPath}`
      );
      expect(projectConfigCache.invalidate).toHaveBeenCalled();
    });

    it('should auto-detect compose file in current directory', async () => {
      const cwd = '/test/project';
      const composeFile = join(cwd, 'docker-compose.yml');
      const config: ProjectConfig = {
        name: 'test-project',
        composeFile,
        projectDir: cwd,
        services: {},
      };

      process.cwd = () => cwd;
      vi.mocked(existsSync).mockImplementation((path: string) => {
        return path === composeFile;
      });
      mockComposeParser.parse.mockReturnValue(config);

      const result = await discovery.findProject();

      expect(result).toEqual(config);
      expect(mockComposeParser.parse).toHaveBeenCalledWith(composeFile);
      expect(projectConfigCache.set).toHaveBeenCalled();
    });

    it('should search in parent directories', async () => {
      const cwd = '/test/project/subdir';
      const parentDir = '/test/project';
      const composeFile = join(parentDir, 'docker-compose.yml');
      const config: ProjectConfig = {
        name: 'test-project',
        composeFile,
        projectDir: parentDir,
        services: {},
      };

      process.cwd = () => cwd;
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === composeFile) return true;
        if (path.startsWith(cwd)) return false;
        return false;
      });
      mockComposeParser.parse.mockReturnValue(config);

      const result = await discovery.findProject();

      expect(result).toEqual(config);
      expect(mockComposeParser.parse).toHaveBeenCalled();
    });

    it('should throw error if no compose file found', async () => {
      const cwd = '/test/project';

      process.cwd = () => cwd;
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(discovery.findProject()).rejects.toThrow(
        'docker-compose.yml not found'
      );
      expect(projectConfigCache.invalidate).toHaveBeenCalled();
    });

    it('should merge multiple compose files', async () => {
      const cwd = '/test/project';
      const baseFile = join(cwd, 'docker-compose.yml');
      const overrideFile = join(cwd, 'docker-compose.override.yml');
      const config: ProjectConfig = {
        name: 'test-project',
        composeFile: baseFile,
        projectDir: cwd,
        services: {
          web: {
            name: 'web',
            type: 'generic',
            image: 'node:18',
          },
        },
      };

      process.cwd = () => cwd;
      vi.mocked(existsSync).mockImplementation((path: string) => {
        return path === baseFile || path === overrideFile;
      });
      
      mockComposeParser.parseRaw
        .mockReturnValueOnce({ services: { web: { image: 'node:18' } } })
        .mockReturnValueOnce({ services: { web: { ports: ['3000:3000'] } } });
      
      mockConfigMerger.merge.mockReturnValue({
        services: {
          web: {
            image: 'node:18',
            ports: ['3000:3000'],
          },
        },
      });

      // Mock internal parseServices method indirectly through loadProject
      // Since loadProject calls parser.parse when files.length === 1,
      // we need to mock it differently for multiple files
      // Actually, looking at the code, loadProject calls parseRaw for multiple files,
      // then uses parseServices internally, so we need to check the actual flow
      
      // For now, let's test the auto-detect with override file
      // The actual merge happens in loadProject which is private
      // We'll test it through findProject
      
      // Actually, we need to mock the result properly
      // Since loadProject for multiple files constructs the result manually,
      // we need to ensure our mocks return the right structure
      
      const result = await discovery.findProject({ cwd });

      // Should call parseRaw for both files
      expect(mockComposeParser.parseRaw).toHaveBeenCalledTimes(2);
      expect(mockConfigMerger.merge).toHaveBeenCalled();
      expect(result.composeFile).toBe(baseFile);
    });

    it('should include environment-specific file if NODE_ENV is set', async () => {
      const cwd = '/test/project';
      const baseFile = join(cwd, 'docker-compose.yml');
      const envFile = join(cwd, 'docker-compose.production.yml');
      const config: ProjectConfig = {
        name: 'test-project',
        composeFile: baseFile,
        projectDir: cwd,
        services: {},
      };

      process.env.NODE_ENV = 'production';
      process.cwd = () => cwd;
      vi.mocked(existsSync).mockImplementation((path: string) => {
        return path === baseFile || path === envFile;
      });

      mockComposeParser.parseRaw
        .mockReturnValueOnce({ services: {} })
        .mockReturnValueOnce({ services: {} });
      mockConfigMerger.merge.mockReturnValue({ services: {} });

      await discovery.findProject({ cwd });

      expect(existsSync).toHaveBeenCalledWith(envFile);
      expect(mockComposeParser.parseRaw).toHaveBeenCalledTimes(2);
    });

    it('should use custom cwd option', async () => {
      const customCwd = '/custom/project';
      const composeFile = join(customCwd, 'docker-compose.yml');
      const config: ProjectConfig = {
        name: 'custom-project',
        composeFile,
        projectDir: customCwd,
        services: {},
      };

      vi.mocked(existsSync).mockImplementation((path: string) => {
        return path === composeFile;
      });
      mockComposeParser.parse.mockReturnValue(config);

      const result = await discovery.findProject({ cwd: customCwd });

      expect(result).toEqual(config);
      expect(mockComposeParser.parse).toHaveBeenCalledWith(composeFile);
    });

    it('should invalidate cache on error', async () => {
      const explicitPath = '/test/docker-compose.yml';

      vi.mocked(existsSync).mockReturnValue(true);
      mockComposeParser.parse.mockImplementation(() => {
        throw new Error('Parse error');
      });

      await expect(discovery.findProject({ explicitPath })).rejects.toThrow('Parse error');
      expect(projectConfigCache.invalidate).toHaveBeenCalled();
    });

    it('should generate correct cache key for explicit path', async () => {
      const explicitPath = '/test/docker-compose.yml';
      const config: ProjectConfig = {
        name: 'test',
        composeFile: explicitPath,
        projectDir: '/test',
        services: {},
      };

      vi.mocked(existsSync).mockReturnValue(true);
      mockComposeParser.parse.mockReturnValue(config);

      await discovery.findProject({ explicitPath });

      expect(projectConfigCache.get).toHaveBeenCalledWith(`project:${explicitPath}`);
      expect(projectConfigCache.set).toHaveBeenCalledWith(`project:${explicitPath}`, config);
    });

    it('should generate correct cache key for cwd', async () => {
      const cwd = '/test/project';
      const composeFile = join(cwd, 'docker-compose.yml');
      const config: ProjectConfig = {
        name: 'test-project',
        composeFile,
        projectDir: cwd,
        services: {},
      };

      process.cwd = () => cwd;
      vi.mocked(existsSync).mockImplementation((path: string) => path === composeFile);
      mockComposeParser.parse.mockReturnValue(config);

      await discovery.findProject();

      expect(projectConfigCache.get).toHaveBeenCalledWith(`project:${cwd}`);
      expect(projectConfigCache.set).toHaveBeenCalledWith(`project:${cwd}`, config);
    });
  });
});

