#!/usr/bin/env node
import { loadSSHConfig } from './dist/utils/ssh-config.js';

console.log('🧪 Testing SSH Profiles Configuration\n');

// Test with profiles
process.env.DOCKER_SSH_PROFILE = 'zaicylab';
process.env.DOCKER_SSH_PROFILES = JSON.stringify({
  zaicylab: {
    host: '109.172.39.241',
    username: 'root',
    port: 22
  },
  production: {
    host: '192.168.1.100',
    username: 'admin',
    port: 2222
  }
});

const result = loadSSHConfig();

if (result.errors.length > 0) {
  console.error('❌ Errors:', result.errors);
  process.exit(1);
}

if (!result.config) {
  console.error('❌ No config loaded');
  process.exit(1);
}

console.log('✅ Profile loaded:', {
  profile: process.env.DOCKER_SSH_PROFILE,
  host: result.config.host,
  username: result.config.username,
  port: result.config.port
});

console.log('\n✅ Profiles configuration works!');
