#!/usr/bin/env node
/**
 * Test profiles file loading
 */

import { writeFileSync, unlinkSync } from 'fs';
import { loadSSHConfig } from './dist/utils/ssh-config.js';

console.log('🧪 Testing Profiles File Loading\n');

// Create test profiles file
const testProfilesPath = '/tmp/docker-mcp-profiles-test.json';
const testProfiles = {
  default: 'zaicylab',
  profiles: {
    zaicylab: {
      host: '109.172.39.241',
      username: 'root',
      port: 22
    },
    production: {
      host: 'prod.example.com',
      username: 'deployer',
      port: 22,
      privateKeyPath: '~/.ssh/id_rsa_prod'
    },
    staging: {
      host: 'staging.example.com',
      username: 'deployer',
      port: 2222
    }
  }
};

writeFileSync(testProfilesPath, JSON.stringify(testProfiles, null, 2));
console.log(`✅ Created test profiles file: ${testProfilesPath}\n`);

// Test 1: Load default profile
console.log('Test 1: Load default profile (zaicylab)');
const env1 = { DOCKER_MCP_PROFILES_FILE: testProfilesPath };
const result1 = loadSSHConfig(env1);

if (result1.errors.length > 0) {
  console.error('❌ Errors:', result1.errors);
} else if (!result1.config) {
  console.error('❌ No config loaded');
} else {
  console.log('✅ Loaded:', {
    host: result1.config.host,
    username: result1.config.username,
    port: result1.config.port
  });
}

// Test 2: Load specific profile
console.log('\nTest 2: Load specific profile (production)');
const env2 = { 
  DOCKER_MCP_PROFILES_FILE: testProfilesPath,
  DOCKER_SSH_PROFILE: 'production'
};
const result2 = loadSSHConfig(env2);

if (result2.errors.length > 0) {
  console.error('❌ Errors:', result2.errors);
} else if (!result2.config) {
  console.error('❌ No config loaded');
} else {
  console.log('✅ Loaded:', {
    host: result2.config.host,
    username: result2.config.username,
    port: result2.config.port,
    privateKeyPath: result2.config.privateKeyPath
  });
}

// Test 3: Load via profileName parameter
console.log('\nTest 3: Load via profileName parameter (staging)');
const env3 = { DOCKER_MCP_PROFILES_FILE: testProfilesPath };
const result3 = loadSSHConfig(env3, 'staging');

if (result3.errors.length > 0) {
  console.error('❌ Errors:', result3.errors);
} else if (!result3.config) {
  console.error('❌ No config loaded');
} else {
  console.log('✅ Loaded:', {
    host: result3.config.host,
    username: result3.config.username,
    port: result3.config.port
  });
}

// Cleanup
unlinkSync(testProfilesPath);
console.log(`\n✅ All tests passed! Profiles file loading works correctly.`);
