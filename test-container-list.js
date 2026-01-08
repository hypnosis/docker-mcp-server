#!/usr/bin/env node
/**
 * Test docker_container_list with project parameter
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { ContainerManager } from './dist/managers/container-manager.js';

console.log('🔍 Testing docker_container_list with project parameter\n');

// Load SSH config from profiles file or env
let sshConfigResult = loadSSHConfig();

// If no config from env, try profiles file
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

if (sshConfigResult.errors.length > 0) {
  console.error('❌ SSH config errors:', sshConfigResult.errors);
  process.exit(1);
}

if (!sshConfigResult.config) {
  console.error('❌ No SSH configuration found.');
  process.exit(1);
}

console.log('✅ SSH Config loaded:', {
  host: sshConfigResult.config.host,
  port: sshConfigResult.config.port || 22,
  username: sshConfigResult.config.username,
});

// Create container manager
const containerManager = new ContainerManager(sshConfigResult.config);

// Test listContainers for gobunnygo project
console.log('\n🔍 Listing containers for project: gobunnygo\n');
try {
  const containers = await containerManager.listContainers('gobunnygo');
  
  console.log(`📦 Found ${containers.length} containers:\n`);
  
  if (containers.length === 0) {
    console.log('⚠️  No containers found');
  } else {
    containers.forEach((container, index) => {
      console.log(`${index + 1}. ${container.name}`);
      console.log(`   Service: ${container.service}`);
      console.log(`   Status: ${container.status}`);
      console.log(`   Image: ${container.image}`);
      console.log(`   Ports: ${container.ports.join(', ') || 'none'}`);
      console.log('');
    });
  }
  
  console.log('✅ List completed successfully!');
} catch (error) {
  console.error('❌ List failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
