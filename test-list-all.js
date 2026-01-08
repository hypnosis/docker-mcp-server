#!/usr/bin/env node
/**
 * Test listContainers - check all containers
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { getDockerClient } from './dist/utils/docker-client.js';

console.log('🔍 Testing listContainers - all containers\n');

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

// Get ALL containers
console.log('📦 Getting ALL containers (all: true)...\n');
const allContainers = await docker.listContainers({ all: true });

console.log(`Total containers: ${allContainers.length}\n`);

// Show running containers
const running = allContainers.filter(c => c.State === 'running');
console.log(`Running: ${running.length}`);
running.forEach(c => {
  const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
  const labels = c.Labels || {};
  const project = labels['com.docker.compose.project'] || 'none';
  const service = labels['com.docker.compose.service'] || 'none';
  console.log(`  ${name} (project: ${project}, service: ${service}, state: ${c.State})`);
});

console.log(`\nStopped: ${allContainers.length - running.length}`);
const stopped = allContainers.filter(c => c.State !== 'running');
stopped.slice(0, 10).forEach(c => {
  const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
  const labels = c.Labels || {};
  const project = labels['com.docker.compose.project'] || 'none';
  const service = labels['com.docker.compose.service'] || 'none';
  console.log(`  ${name} (project: ${project}, service: ${service}, state: ${c.State})`);
});

// Check specific projects
console.log('\n\n🔍 Checking specific projects:\n');

const projects = ['gobunnygo', 'alina', 'n8n-services', 'pptx-gen', 'rollyourday'];

for (const projectName of projects) {
  const projectContainers = allContainers.filter(c => {
    const labels = c.Labels || {};
    return labels['com.docker.compose.project'] === projectName;
  });
  
  const runningInProject = projectContainers.filter(c => c.State === 'running');
  const stoppedInProject = projectContainers.filter(c => c.State !== 'running');
  
  console.log(`${projectName}:`);
  console.log(`  Total: ${projectContainers.length}`);
  console.log(`  Running: ${runningInProject.length}`);
  console.log(`  Stopped: ${stoppedInProject.length}`);
  
  if (runningInProject.length > 0) {
    console.log(`  Running containers:`);
    runningInProject.forEach(c => {
      const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
      const service = c.Labels?.['com.docker.compose.service'] || 'unknown';
      console.log(`    - ${name} (service: ${service})`);
    });
  }
  console.log('');
}
