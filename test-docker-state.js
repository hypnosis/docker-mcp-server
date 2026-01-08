#!/usr/bin/env node
/**
 * Test Docker container state from API
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { getDockerClient } from './dist/utils/docker-client.js';

console.log('🔍 Testing Docker container state\n');

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

// Get all containers
console.log('📦 Getting all containers...\n');
const containers = await docker.listContainers({ all: true });

// Filter gobunnygo project
const gobunnygoContainers = containers.filter(c => {
  const labels = c.Labels || {};
  return labels['com.docker.compose.project'] === 'gobunnygo';
});

console.log(`Found ${gobunnygoContainers.length} containers for gobunnygo:\n`);

gobunnygoContainers.forEach(c => {
  const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
  const labels = c.Labels || {};
  console.log(`Container: ${name}`);
  console.log(`  State: ${c.State}`);
  console.log(`  Status: ${c.Status}`);
  console.log(`  Labels:`);
  console.log(`    project: ${labels['com.docker.compose.project']}`);
  console.log(`    service: ${labels['com.docker.compose.service']}`);
  console.log('');
});

// Filter alina project
const alinaContainers = containers.filter(c => {
  const labels = c.Labels || {};
  return labels['com.docker.compose.project'] === 'alina';
});

console.log(`\nFound ${alinaContainers.length} containers for alina:\n`);

alinaContainers.forEach(c => {
  const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
  const labels = c.Labels || {};
  console.log(`Container: ${name}`);
  console.log(`  State: ${c.State}`);
  console.log(`  Status: ${c.Status}`);
  console.log(`  Labels:`);
  console.log(`    project: ${labels['com.docker.compose.project']}`);
  console.log(`    service: ${labels['com.docker.compose.service']}`);
  console.log('');
});
