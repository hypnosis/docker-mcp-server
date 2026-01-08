#!/usr/bin/env node
/**
 * Debug: Compare SSH docker ps vs Docker API listContainers
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { getDockerClient } from './dist/utils/docker-client.js';
import { execSSH } from './dist/utils/ssh-exec.js';

console.log('🔍 Debug: Comparing SSH docker ps vs Docker API\n');

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

const dockerClient = getDockerClient(sshConfigResult.config);
const docker = dockerClient.getClient();

// Get containers via Docker API
console.log('📦 Via Docker API (listContainers):\n');
const apiContainers = await docker.listContainers({ all: true });
const apiRunning = apiContainers.filter(c => c.State === 'running');
console.log(`Total: ${apiContainers.length}, Running: ${apiRunning.length}`);
apiRunning.forEach(c => {
  const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
  const labels = c.Labels || {};
  const project = labels['com.docker.compose.project'] || 'none';
  console.log(`  ${name} (project: ${project}, state: ${c.State})`);
});

// Get containers via SSH
console.log('\n📦 Via SSH (docker ps):\n');
const sshResult = await execSSH('docker ps --format "{{.Names}}\t{{.State}}"', {
  sshConfig: sshConfigResult.config,
  timeout: 10000,
});
const sshOutput = sshResult.stdout;

const sshLines = sshOutput.trim().split('\n').filter(l => l.trim());
console.log(`Total running: ${sshLines.length}`);
sshLines.forEach(line => {
  const [name, state] = line.split('\t');
  console.log(`  ${name} (state: ${state})`);
});

// Check specific containers
console.log('\n🔍 Checking specific containers:\n');
const checkContainers = ['gobunnygo-prod', 'alina-web-1', 'n8n', 'pptx-generator-web', 'rollyourday-bot'];

for (const containerName of checkContainers) {
  // Check via Docker API
  const apiContainer = apiContainers.find(c => 
    c.Names.some(n => n.replace(/^\//, '') === containerName)
  );
  
  // Check via SSH
  const sshCheckResult = await execSSH(`docker inspect ${containerName} --format '{{.State.Status}}' 2>/dev/null || echo "not found"`, {
    sshConfig: sshConfigResult.config,
    timeout: 5000,
  });
  const sshCheck = sshCheckResult.stdout;
  
  console.log(`${containerName}:`);
  if (apiContainer) {
    const labels = apiContainer.Labels || {};
    console.log(`  API: Found (state: ${apiContainer.State}, project: ${labels['com.docker.compose.project'] || 'none'})`);
  } else {
    console.log(`  API: NOT FOUND`);
  }
  const sshStatus = sshCheck.trim();
  if (sshStatus !== 'not found' && sshStatus) {
    console.log(`  SSH: Found (state: ${sshStatus})`);
  } else {
    console.log(`  SSH: NOT FOUND`);
  }
  console.log('');
}
