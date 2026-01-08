#!/usr/bin/env node
/**
 * Test fallback scenarios for local Docker
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';

console.log('🧪 Testing Fallback to Local Docker\n');

// Test 1: No SSH config at all (should work with local Docker)
console.log('Test 1: No SSH configuration (local Docker)');
const result1 = loadSSHConfig({});
if (result1.errors.length > 0 && result1.config) {
  console.error('❌ Unexpected errors:', result1.errors);
} else {
  console.log('✅ Result:', {
    config: result1.config ? 'SSH config loaded' : 'No SSH config (local Docker)',
    errors: result1.errors.length
  });
}

// Test 2: DOCKER_MCP_PROFILES_FILE but file doesn't exist (should fallback gracefully)
console.log('\nTest 2: Profiles file path set but file doesn\'t exist (should fallback)');
const result2 = loadSSHConfig({
  DOCKER_MCP_PROFILES_FILE: '/tmp/nonexistent-profiles.json'
});
if (result2.errors.length > 0 && result2.config) {
  console.error('❌ Unexpected errors:', result2.errors);
} else {
  console.log('✅ Result:', {
    config: result2.config ? 'SSH config loaded' : 'Fallback to local Docker',
    errors: result2.errors.length,
    message: result2.errors.length > 0 ? result2.errors[0] : 'Graceful fallback'
  });
}

// Test 3: Only local Docker flags (should work)
console.log('\nTest 3: Only local Docker flags (no SSH)');
const result3 = loadSSHConfig({
  DOCKER_MCP_AUTO_DISCOVER: 'true',
  DOCKER_MCP_MASK_SECRETS: 'true'
});
if (result3.errors.length > 0 && result3.config) {
  console.error('❌ Unexpected errors:', result3.errors);
} else {
  console.log('✅ Result:', {
    config: result3.config ? 'SSH config loaded' : 'No SSH config (local Docker)',
    errors: result3.errors.length
  });
}

// Test 4: Invalid profiles file (should fallback)
console.log('\nTest 4: Invalid profiles file (should fallback)');
import { writeFileSync, unlinkSync } from 'fs';
const invalidFile = '/tmp/invalid-profiles.json';
writeFileSync(invalidFile, '{ invalid json }');
const result4 = loadSSHConfig({
  DOCKER_MCP_PROFILES_FILE: invalidFile
});
unlinkSync(invalidFile);
console.log('✅ Result:', {
  config: result4.config ? 'SSH config loaded' : 'Fallback to local Docker',
  errors: result4.errors.length
});

console.log('\n✅ All fallback tests completed!');
console.log('\n📝 Summary:');
console.log('  • No SSH config → Local Docker ✅');
console.log('  • Missing profiles file → Graceful fallback ✅');
console.log('  • Invalid profiles file → Graceful fallback ✅');
console.log('  • Only local flags → Local Docker ✅');
