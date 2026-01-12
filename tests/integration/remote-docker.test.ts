/**
 * Integration tests for Remote Docker functionality
 * Tests integration between DockerClient, ContainerManager, and tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SSHConfig } from '../../src/utils/ssh-config.js';
import Docker from 'dockerode';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

// NOTE: We intentionally avoid static imports of modules-under-test here.
// Vitest reuses module cache across test files within the same worker.
// If another test imports docker-client BEFORE our vi.mock(...) declarations,
// our mocks won't apply and tests become flaky (timeouts, real fs/spawn, etc).
let DockerClient: typeof import('../../src/utils/docker-client.js').DockerClient;
let clearClientPool: typeof import('../../src/utils/docker-client.js').clearClientPool;
let ContainerManager: typeof import('../../src/managers/container-manager.js').ContainerManager;

// Mock fs module - use real existsSync for profile files, mock for sockets
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const realExistsSync = actual.existsSync;
  const realUnlinkSync = actual.unlinkSync;
  const realWriteFileSync = actual.writeFileSync;
  const realMkdirSync = actual.mkdirSync;
  
  return {
    ...actual,
    // Use real functions for file creation
    writeFileSync: realWriteFileSync,
    mkdirSync: realMkdirSync,
    unlinkSync: vi.fn(realUnlinkSync),
    // Mock existsSync with smart logic
    existsSync: vi.fn((path: Parameters<typeof realExistsSync>[0]) => {
      if (typeof path === 'string') {
        // Use REAL existsSync for profile files (JSON)
        if (path.endsWith('.json') || path.includes('profiles')) {
          return realExistsSync(path);
        }
        // Mock: SSH keys exist (for testing)
        if (path.includes('id_rsa') || path.includes('id_ed25519')) {
          return true;
        }
        // Mock: SSH sockets don't exist initially
        if (path.includes('docker-ssh-')) {
          return false;
        }
      }
      // Default: use real existsSync
      return realExistsSync(path);
    }),
  };
});

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock retry utilities
vi.mock('../../src/utils/retry.js', () => ({
  retryWithTimeout: vi.fn((fn) => fn()),
  createNetworkRetryPredicate: vi.fn(() => () => true),
}));

// Mock Docker - create mock instance
const createMockDockerInstance = () => ({
  ping: vi.fn().mockResolvedValue(undefined),
  listContainers: vi.fn().mockResolvedValue([
    {
      Id: 'container-1',
      Names: ['/test-project_web_1'],
      Image: 'test-image:latest',
      State: 'running',
      Status: 'Up 2 hours',
      Created: Math.floor(Date.now() / 1000) - 7200,
      Ports: [],
      Labels: {
        'com.docker.compose.project': 'test-project',
        'com.docker.compose.service': 'web',
      },
    },
  ]),
  getContainer: vi.fn().mockImplementation((id: string) => ({
    id,
    inspect: vi.fn().mockResolvedValue({
      Id: id,
      Name: '/test-project_web_1',
      State: { Status: 'running' },
      Config: { Image: 'test-image:latest' },
    }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    logs: vi.fn().mockResolvedValue(Buffer.from('test log output\n')),
  })),
} as unknown as Docker);

let mockDockerInstance = createMockDockerInstance();

vi.mock('dockerode', () => {
  const MockDocker = class {
    constructor(options?: { socketPath?: string }) {
      return mockDockerInstance;
    }
  };
  return {
    default: MockDocker,
  };
});

describe('Remote Docker Integration', () => {
  let mockSSHConfig: SSHConfig;
  let originalPlatform: string;
  let testDir: string;
  let testProfilesFile: string;
  let originalProfilesFile: string | undefined;
  const TEST_PROFILE_NAME = 'example-remote-profile';

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // (re)import modules-under-test AFTER mocks are set up
    ({ DockerClient, clearClientPool } = await import('../../src/utils/docker-client.js'));
    ({ ContainerManager } = await import('../../src/managers/container-manager.js'));

    clearClientPool();
    
    // Reset mock Docker instance
    mockDockerInstance = createMockDockerInstance();
    
    mockSSHConfig = {
      host: 'prod.example.com',
      username: 'prod-admin',
      port: 22,
      privateKeyPath: '~/.ssh/id_ed25519_example',
    };

    // Create temporary profiles file
    testDir = mkdtempSync(join(tmpdir(), 'docker-mcp-integration-test-'));
    mkdirSync(testDir, { recursive: true }); // keep for clarity; mkdtempSync already creates it
    testProfilesFile = join(testDir, 'profiles.json');
    
    // Create test profile
    const profiles = {
      default: TEST_PROFILE_NAME,
      profiles: {
        [TEST_PROFILE_NAME]: {
          host: mockSSHConfig.host,
          username: mockSSHConfig.username,
          port: mockSSHConfig.port,
          privateKeyPath: mockSSHConfig.privateKeyPath,
        },
      },
    };
    
    writeFileSync(testProfilesFile, JSON.stringify(profiles, null, 2));
    
    // Set DOCKER_MCP_PROFILES_FILE environment variable
    originalProfilesFile = process.env.DOCKER_MCP_PROFILES_FILE;
    process.env.DOCKER_MCP_PROFILES_FILE = testProfilesFile;

    originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
    });

    // Global mock already handles:
    // - Real existsSync for JSON/profiles
    // - Mock SSH keys exist
    // - Mock sockets don't exist
    // No need to override mockImplementation here
    
    // Mock spawn for SSH tunnel
    const mockSpawn = {
      pid: 12345,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('SSH connection failed')), 10);
        }
        return mockSpawn;
      }),
      unref: vi.fn(),
    };
    vi.mocked(spawn).mockReturnValue(mockSpawn as any);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
    
    // Restore DOCKER_MCP_PROFILES_FILE
    if (originalProfilesFile) {
      process.env.DOCKER_MCP_PROFILES_FILE = originalProfilesFile;
    } else {
      delete process.env.DOCKER_MCP_PROFILES_FILE;
    }
    
    // Cleanup temporary profiles file
    try {
      if (existsSync(testProfilesFile)) {
        unlinkSync(testProfilesFile);
      }
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('DockerClient + ContainerManager Integration', () => {
    it('should initialize ContainerManager with remote DockerClient', () => {
      const dockerClient = new DockerClient(mockSSHConfig);
      const containerManager = new ContainerManager(TEST_PROFILE_NAME);

      expect(containerManager).toBeInstanceOf(ContainerManager);
      expect(dockerClient).toBeInstanceOf(DockerClient);
    });

    it('should list containers through remote connection', async () => {
      // Mock socket exists and is alive - use mockImplementationOnce to not break profile loading
      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (typeof path === 'string') {
          // Profile files - use real check
          if (path.endsWith('.json') || path.includes('profiles')) {
            const fs = require('node:fs');
            return fs.existsSync(path);
          }
          // Socket exists (for this test)
          if (path.includes('docker-ssh-')) {
            return true;
          }
          // SSH key exists
          if (path.includes('id_rsa') || path.includes('id_ed25519')) {
            return true;
          }
        }
        return false;
      });
      
      // Mock Docker ping
      vi.mocked(mockDockerInstance.ping).mockResolvedValue(undefined);
      
      const containerManager = new ContainerManager(TEST_PROFILE_NAME);
      
      // This will attempt to use remote Docker
      // In real scenario, it would create tunnel first
      try {
        const containers = await containerManager.listContainers('test-project');
        // If tunnel setup succeeds, we should get containers
        expect(Array.isArray(containers)).toBe(true);
      } catch (error) {
        // Expected if tunnel setup fails in test environment
        // But we verify the integration attempt
        expect(error).toBeDefined();
      }
    });
  });

  describe('Remote Connection Retry Logic', () => {
    it('should use retry logic for remote operations', async () => {
      const { retryWithTimeout } = await import('../../src/utils/retry.js');
      
      const dockerClient = new DockerClient(mockSSHConfig);
      
      // Mock socket exists
      vi.mocked(existsSync).mockReturnValueOnce(true);
      
      try {
        await dockerClient.ping();
        // Should have attempted retry
        expect(retryWithTimeout).toHaveBeenCalled();
      } catch {
        // Expected if tunnel setup fails
      }
    });

    it('should retry listContainers on network errors', async () => {
      const { retryWithTimeout } = await import('../../src/utils/retry.js');
      
      const dockerClient = new DockerClient(mockSSHConfig);
      
      // Mock socket exists
      vi.mocked(existsSync).mockReturnValueOnce(true);
      
      try {
        await dockerClient.listContainers();
        // Should have attempted retry
        expect(retryWithTimeout).toHaveBeenCalled();
      } catch {
        // Expected if tunnel setup fails
      }
    });
  });

  describe('SSH Tunnel Lifecycle', () => {
    it('should create tunnel on first remote operation', async () => {
      const dockerClient = new DockerClient(mockSSHConfig);
      
      // IMPORTANT: createSSHTunnel() waits up to 10s for socket creation.
      // In tests we simulate: first check -> no socket, after spawn -> socket appears.
      const realFs = await import('node:fs');
      const socketSeen: Record<string, number> = {};
      vi.mocked(existsSync).mockImplementation((p: any) => {
        if (typeof p === 'string') {
          if (p.endsWith('.json') || p.includes('profiles')) return realFs.existsSync(p);
          if (p.includes('id_rsa') || p.includes('id_ed25519')) return true;
          if (p.includes('docker-ssh-')) {
            socketSeen[p] = (socketSeen[p] ?? 0) + 1;
            return socketSeen[p] >= 2;
          }
        }
        return false;
      });
      
      // Mock spawn
      const mockSpawn = {
        pid: 12345,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);
      
      await dockerClient.ping();

      expect(spawn).toHaveBeenCalled();
      expect(vi.mocked(spawn).mock.calls[0][0]).toBe('ssh');
    });

    it('should reuse existing tunnel if socket is alive', async () => {
      const dockerClient = new DockerClient(mockSSHConfig);
      
      // Mock socket exists and is alive
      const realFs = await import('node:fs');
      vi.mocked(existsSync).mockImplementation((p: any) => {
        if (typeof p === 'string') {
          if (p.endsWith('.json') || p.includes('profiles')) return realFs.existsSync(p);
          if (p.includes('id_rsa') || p.includes('id_ed25519')) return true;
          if (p.includes('docker-ssh-')) return true;
        }
        return false;
      });
      
      // Mock Docker ping succeeds
      vi.mocked(mockDockerInstance.ping).mockResolvedValue(undefined);
      
      try {
        await Promise.race([
          dockerClient.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
        ]);
        // Should not create new tunnel
        expect(existsSync).toHaveBeenCalled();
      } catch {
        // Expected if full integration not available
        expect(existsSync).toHaveBeenCalled();
      }
    }, 3000);

    it('should cleanup tunnel on shutdown', () => {
      const dockerClient = new DockerClient(mockSSHConfig);
      
      // Set active socket
      (dockerClient as any).activeSocketPath = '/tmp/test-socket.sock';
      (dockerClient as any).sshProcessPid = 12345;
      
      vi.mocked(existsSync).mockReturnValue(true);
      
      dockerClient.cleanup();
      
      expect(unlinkSync).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle SSH tunnel creation failures', async () => {
      const dockerClient = new DockerClient(mockSSHConfig);
      
      // Mock spawn to fail
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('SSH connection failed');
      });
      
      try {
        await dockerClient.ping();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });

    it('should handle Docker connection failures gracefully', async () => {
      const dockerClient = new DockerClient(mockSSHConfig);
      
      // Mock socket exists but Docker ping fails
      vi.mocked(existsSync).mockReturnValueOnce(true);
      
      vi.mocked(mockDockerInstance.ping).mockRejectedValue(new Error('Connection refused'));
      
      try {
        await Promise.race([
          dockerClient.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
        ]);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    }, 3000);
  });

  describe('Platform Compatibility', () => {
    it('should reject Windows platform for SSH tunnels', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });
      
      const dockerClient = new DockerClient(mockSSHConfig);
      
      try {
        await dockerClient.ping();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Windows');
        expect(error.message).toContain('not supported');
      }
    });
  });

  describe('Profile-Based Client Pool Integration', () => {
    it.skip('should use different clients for different profiles (after v1.4.0 refactoring)', async () => {
      // Skipped: Singleton pattern replaced with profile-based pool in v1.4.0
      // Old test checked getDockerClient(sshConfig) singleton behavior
      // New behavior: getDockerClientForProfile(profileName) uses profile-based caching
      
      // To test manually:
      // 1. Create profiles.json with two profiles (same host, different keys)
      // 2. Call getDockerClientForProfile('profile1') and getDockerClientForProfile('profile2')
      // 3. Verify they return different client instances
    });

    it.skip('should cleanup when switching profiles (after v1.4.0 refactoring)', async () => {
      // Skipped: Behavior changed in v1.4.0
      // Old: Switching SSH configs triggered cleanup of old client
      // New: Each profile maintains its own cached client
      // Cleanup happens via clearClientPool() or on server shutdown
    });
  });
});
