#!/usr/bin/env node
/**
 * Test SSH tunnel creation fix
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { getDockerClient, resetDockerClient } from './dist/utils/docker-client.js';

console.log('🧪 Testing SSH Tunnel Creation Fix\n');

// Load SSH config
console.log('Loading SSH configuration...');
const sshConfigResult = loadSSHConfig();

if (sshConfigResult.errors.length > 0) {
  console.error('❌ SSH config errors:', sshConfigResult.errors);
  process.exit(1);
}

if (!sshConfigResult.config) {
  console.error('❌ No SSH configuration found');
  process.exit(1);
}

console.log('✅ SSH Config loaded:', {
  host: sshConfigResult.config.host,
  port: sshConfigResult.config.port || 22,
  username: sshConfigResult.config.username,
});

// Test Docker connection
console.log('\nTesting Docker connection with SSH tunnel...');
resetDockerClient();
const docker = getDockerClient(sshConfigResult.config);

try {
  await docker.ping();
  console.log('✅ Docker connection successful!');
  
  // Test listing containers
  console.log('\nTesting container list...');
  const containers = await docker.listContainers({ all: true });
  console.log(`✅ Found ${containers.length} containers`);
  
  if (containers.length > 0) {
    console.log('\nFirst 3 containers:');
    containers.slice(0, 3).forEach((container) => {
      const names = container.Names.map(n => n.replace(/^\//, '')).join(', ');
      console.log(`  - ${names} (${container.Status})`);
    });
  }
  
  console.log('\n✅ All tests passed! SSH tunnel is working correctly.');
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
