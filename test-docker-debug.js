#!/usr/bin/env node
/**
 * Debug: Check Docker connection and compare results
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { getDockerClient } from './dist/utils/docker-client.js';
import { execSSH } from './dist/utils/ssh-exec.js';

console.log('🔍 Debug: Docker connection analysis\n');

// Load SSH config
let sshConfigResult = loadSSHConfig();
if (!sshConfigResult.config && process.env.DOCKER_MCP_PROFILES_FILE) {
  const profilesFile = process.env.DOCKER_MCP_PROFILES_FILE.replace('~', process.env.HOME || '');
  const fileResult = loadProfilesFile(profilesFile);
  if (fileResult.config) {
    const defaultProfile = fileResult.config.default || 'zaicylab';
    const profileData = fileResult.config.profiles[defaultProfile];
    if (profileData) {
      const config = profileDataToSSHConfig(profileData);
      sshConfigResult = { config, errors: [] };
    }
  }
}

if (!sshConfigResult.config) {
  console.error('❌ No SSH config');
  process.exit(1);
}

console.log('SSH Config:', {
  host: sshConfigResult.config.host,
  port: sshConfigResult.config.port || 22,
  username: sshConfigResult.config.username,
});

// Get Docker client
const dockerClient = getDockerClient(sshConfigResult.config);
const docker = dockerClient.getClient();

// Check Docker info via API
console.log('\n📊 Docker Info via API:');
try {
  const info = await docker.info();
  console.log('  Name:', info.Name);
  console.log('  Containers:', info.Containers);
  console.log('  Running:', info.ContainersRunning);
  console.log('  Paused:', info.ContainersPaused);
  console.log('  Stopped:', info.ContainersStopped);
  console.log('  OS:', info.OperatingSystem);
} catch (e) {
  console.log('  Error:', e.message);
}

// Check Docker info via SSH
console.log('\n📊 Docker Info via SSH:');
try {
  const result = await execSSH('docker info --format "Name: {{.Name}}\nContainers: {{.Containers}}\nRunning: {{.ContainersRunning}}\nPaused: {{.ContainersPaused}}\nStopped: {{.ContainersStopped}}\nOS: {{.OperatingSystem}}"', {
    sshConfig: sshConfigResult.config,
    timeout: 10000,
  });
  console.log(result.stdout);
} catch (e) {
  console.log('  Error:', e.message);
}

// List containers via API
console.log('\n📦 Containers via API (listContainers all:true):');
try {
  const containers = await docker.listContainers({ all: true });
  console.log('  Total:', containers.length);
  const running = containers.filter(c => c.State === 'running');
  console.log('  Running:', running.length);
  running.forEach(c => {
    const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
    console.log(`    - ${name} (${c.State})`);
  });
} catch (e) {
  console.log('  Error:', e.message);
}

// List containers via SSH
console.log('\n📦 Containers via SSH (docker ps -a):');
try {
  const result = await execSSH('docker ps -a --format "{{.Names}}\t{{.State}}"', {
    sshConfig: sshConfigResult.config,
    timeout: 10000,
  });
  const lines = result.stdout.trim().split('\n');
  console.log('  Total:', lines.length);
  const running = lines.filter(l => l.includes('running'));
  console.log('  Running:', running.length);
  running.forEach(l => {
    const [name, state] = l.split('\t');
    console.log(`    - ${name} (${state})`);
  });
} catch (e) {
  console.log('  Error:', e.message);
}

// Check if we're connecting to LOCAL or REMOTE Docker
console.log('\n🔍 Connection check:');
try {
  const apiInfo = await docker.info();
  const sshResult = await execSSH('hostname', {
    sshConfig: sshConfigResult.config,
    timeout: 5000,
  });
  
  console.log('  API Docker Name:', apiInfo.Name);
  console.log('  SSH hostname:', sshResult.stdout.trim());
  
  if (apiInfo.Name !== sshResult.stdout.trim()) {
    console.log('\n⚠️  WARNING: Docker API and SSH are connecting to DIFFERENT hosts!');
    console.log('    API is connected to LOCAL Docker, not remote!');
  } else {
    console.log('\n✅ Docker API and SSH are connecting to the SAME host');
  }
} catch (e) {
  console.log('  Error:', e.message);
}
