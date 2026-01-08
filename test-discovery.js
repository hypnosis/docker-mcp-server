#!/usr/bin/env node
/**
 * Test Remote Project Discovery
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { getDockerClient } from './dist/utils/docker-client.js';
import { RemoteProjectDiscovery } from './dist/discovery/remote-discovery.js';

console.log('🔍 Testing Remote Project Discovery\n');

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
  console.error('❌ No SSH configuration found. Set DOCKER_SSH_* environment variables.');
  process.exit(1);
}

console.log('✅ SSH Config loaded:', {
  host: sshConfigResult.config.host,
  port: sshConfigResult.config.port || 22,
  username: sshConfigResult.config.username,
});

// Get Docker client
const dockerClient = getDockerClient(sshConfigResult.config);
const docker = dockerClient.getClient();

// Test ping
try {
  await dockerClient.ping();
  console.log('✅ Docker connection successful!\n');
} catch (error) {
  console.error('❌ Docker connection failed:', error.message);
  process.exit(1);
}

// Create discovery instance with wrapper (handles SSH tunnel)
const discovery = new RemoteProjectDiscovery(sshConfigResult.config, dockerClient);

// Discover projects
console.log('🔍 Discovering projects...\n');
try {
  const projectsPath = sshConfigResult.config.projectsPath || '/var/www';
  
  const result = await discovery.discoverProjects({
    sshConfig: sshConfigResult.config,
    dockerClient: docker,
    basePath: projectsPath,
  });

  console.log(`📊 Summary:`);
  console.log(`   Total: ${result.summary.total}`);
  console.log(`   Running: ${result.summary.running}`);
  console.log(`   Partial: ${result.summary.partial}`);
  console.log(`   Stopped: ${result.summary.stopped}\n`);

  if (result.projects.length === 0) {
    console.log('⚠️  No projects found');
  } else {
    console.log(`📦 Found ${result.projects.length} projects:\n`);
    
    result.projects.forEach((project, index) => {
      const statusIcon = project.status === 'running' ? '✅' : 
                        project.status === 'partial' ? '⚠️' : '❌';
      
      console.log(`${index + 1}. ${statusIcon} ${project.name}`);
      console.log(`   Path: ${project.path}`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Containers: ${project.runningContainers}/${project.totalServices}`);
      console.log(`   Services: ${project.services.join(', ')}`);
      
      if (project.issues.length > 0) {
        console.log(`   Issues:`);
        project.issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      }
      console.log('');
    });
  }

  console.log('✅ Discovery completed successfully!');
} catch (error) {
  console.error('❌ Discovery failed:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  // Cleanup SSH tunnel to prevent hanging
  dockerClient.cleanup();
  process.exit(0);
}
