#!/usr/bin/env node
/**
 * Тест сравнения MCP vs SSH для списка контейнеров
 * Сравнивает полноту ответа и скорость
 */

import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { getDockerClient, cleanupDockerClient } from './dist/utils/docker-client.js';
import { RemoteProjectDiscovery } from './dist/discovery/remote-discovery.js';
import { execSSH } from './dist/utils/ssh-exec.js';

async function testMCP() {
  console.log('\n🔵 === MCP METHOD (docker_discover_projects) ===\n');
  const startTime = Date.now();
  
  try {
    const sshConfigResult = loadSSHConfig();
    if (!sshConfigResult.config) {
      throw new Error('SSH config not found');
    }
    
    const sshConfig = sshConfigResult.config;
    const dockerClient = getDockerClient(sshConfig);
    
    const discovery = new RemoteProjectDiscovery(sshConfig, dockerClient);
    const result = await discovery.discoverProjects({
      sshConfig,
      dockerClient: dockerClient.getClient(),
      basePath: sshConfig.projectsPath,
      timeout: 30000,
    });
    
    const elapsed = Date.now() - startTime;
    
    // Получаем все контейнеры через Docker API для сравнения
    const allContainersAPI = await dockerClient.listContainers({ all: true });
    
    // Собираем контейнеры по проектам из MCP результата
    const allContainers = [];
    for (const project of result.projects) {
      // Находим контейнеры проекта по labels
      const projectContainers = allContainersAPI.filter(container => {
        const labels = container.Labels || {};
        return labels['com.docker.compose.project'] === project.name;
      });
      
      for (const container of projectContainers) {
        const name = container.Names[0]?.replace(/^\//, '') || 'unknown';
        const labels = container.Labels || {};
        allContainers.push({
          name,
          status: container.State,
          service: labels['com.docker.compose.service'] || 'unknown',
          project: project.name,
        });
      }
    }
    
    return {
      method: 'MCP',
      elapsed,
      projects: result.projects,
      containers: allContainers,
      summary: result.summary,
    };
  } catch (error) {
    console.error('❌ MCP Error:', error.message);
    throw error;
  }
}

async function testSSH() {
  console.log('\n🟢 === SSH METHOD (docker ps) ===\n');
  const startTime = Date.now();
  
  try {
    const sshConfigResult = loadSSHConfig();
    if (!sshConfigResult.config) {
      throw new Error('SSH config not found');
    }
    
    const sshConfig = sshConfigResult.config;
    
    // Получаем все контейнеры через SSH (используем docker inspect для labels)
    const psResult = await execSSH(
      `docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Image}}'`,
      {
        sshConfig,
        timeout: 30000,
      }
    );
    
    const elapsed = Date.now() - startTime;
    
    if (psResult.code !== 0) {
      throw new Error(`SSH command failed: ${psResult.stderr}`);
    }
    
    // Парсим результат
    const containers = [];
    const lines = psResult.stdout.trim().split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      const [name, status, image] = line.split('\t');
      if (name) {
        containers.push({
          name: name.trim(),
          status: status.trim(),
          image: image.trim(),
        });
      }
    }
    
    // Получаем labels для каждого контейнера через docker inspect (оптимизированно)
    if (containers.length > 0) {
      const containerNames = containers.map(c => c.name).join(' ');
      const inspectResult = await execSSH(
        `docker ps -q | xargs -r docker inspect --format '{{.Name}}\t{{index .Config.Labels "com.docker.compose.project"}}\t{{index .Config.Labels "com.docker.compose.service"}}'`,
        {
          sshConfig,
          timeout: 30000,
        }
      );
      
      if (inspectResult.code === 0 && inspectResult.stdout) {
        const inspectLines = inspectResult.stdout.trim().split('\n').filter(l => l.trim());
        const labelsMap = new Map();
        
        for (const line of inspectLines) {
          const [name, project, service] = line.split('\t');
          if (name) {
            const cleanName = name.replace(/^\//, '').trim();
            labelsMap.set(cleanName, {
              project: (project || '').trim() || 'unknown',
              service: (service || '').trim() || 'unknown',
            });
          }
        }
        
        // Добавляем labels к контейнерам
        for (const container of containers) {
          const labels = labelsMap.get(container.name) || { project: 'unknown', service: 'unknown' };
          container.project = labels.project;
          container.service = labels.service;
        }
      }
    }
    
    // Группируем по проектам
    const projectsMap = new Map();
    for (const container of containers) {
      const project = container.project || 'unknown';
      if (!projectsMap.has(project)) {
        projectsMap.set(project, {
          name: project,
          containers: [],
        });
      }
      projectsMap.get(project).containers.push(container);
    }
    
    const projects = Array.from(projectsMap.values());
    
    // Подсчитываем статистику
    let running = 0;
    let stopped = 0;
    for (const container of containers) {
      if (container.status.includes('Up')) {
        running++;
      } else {
        stopped++;
      }
    }
    
    return {
      method: 'SSH',
      elapsed,
      projects,
      containers,
      summary: {
        total: projects.length,
        running,
        stopped,
        totalContainers: containers.length,
      },
    };
  } catch (error) {
    console.error('❌ SSH Error:', error.message);
    throw error;
  }
}

function compareResults(mcpResult, sshResult) {
  console.log('\n📊 === COMPARISON ===\n');
  
  // Сравнение скорости
  console.log('⏱️  SPEED:');
  console.log(`   MCP:  ${mcpResult.elapsed}ms`);
  console.log(`   SSH:  ${sshResult.elapsed}ms`);
  const speedDiff = ((mcpResult.elapsed - sshResult.elapsed) / sshResult.elapsed * 100).toFixed(1);
  if (mcpResult.elapsed > sshResult.elapsed) {
    console.log(`   ⚠️  MCP медленнее на ${speedDiff}%`);
  } else {
    console.log(`   ✅ MCP быстрее на ${Math.abs(speedDiff)}%`);
  }
  
  // Сравнение полноты
  console.log('\n📦 COMPLETENESS:');
  console.log(`   MCP Projects: ${mcpResult.projects.length}`);
  console.log(`   SSH Projects: ${sshResult.projects.length}`);
  console.log(`   MCP Containers: ${mcpResult.containers.length}`);
  console.log(`   SSH Containers: ${sshResult.containers.length}`);
  
  // Находим различия
  const mcpContainerNames = new Set(mcpResult.containers.map(c => c.name));
  const sshContainerNames = new Set(sshResult.containers.map(c => c.name));
  
  const onlyInMCP = Array.from(mcpContainerNames).filter(n => !sshContainerNames.has(n));
  const onlyInSSH = Array.from(sshContainerNames).filter(n => !mcpContainerNames.has(n));
  
  if (onlyInMCP.length > 0) {
    console.log(`\n   ⚠️  Только в MCP (${onlyInMCP.length}):`);
    onlyInMCP.slice(0, 5).forEach(name => console.log(`      - ${name}`));
    if (onlyInMCP.length > 5) {
      console.log(`      ... и еще ${onlyInMCP.length - 5}`);
    }
  }
  
  if (onlyInSSH.length > 0) {
    console.log(`\n   ⚠️  Только в SSH (${onlyInSSH.length}):`);
    onlyInSSH.slice(0, 5).forEach(name => console.log(`      - ${name}`));
    if (onlyInSSH.length > 5) {
      console.log(`      ... и еще ${onlyInSSH.length - 5}`);
    }
  }
  
  if (onlyInMCP.length === 0 && onlyInSSH.length === 0) {
    console.log(`\n   ✅ Все контейнеры найдены в обоих методах`);
  }
  
  // Сравнение проектов
  console.log('\n📋 PROJECTS:');
  const mcpProjectNames = new Set(mcpResult.projects.map(p => p.name));
  const sshProjectNames = new Set(sshResult.projects.map(p => p.name).filter(n => n !== 'unknown'));
  
  const onlyInMCPProjects = Array.from(mcpProjectNames).filter(n => !sshProjectNames.has(n));
  const onlyInSSHProjects = Array.from(sshProjectNames).filter(n => !mcpProjectNames.has(n));
  
  if (onlyInMCPProjects.length > 0) {
    console.log(`   ⚠️  Только в MCP (${onlyInMCPProjects.length}): ${onlyInMCPProjects.join(', ')}`);
  }
  if (onlyInSSHProjects.length > 0) {
    console.log(`   ⚠️  Только в SSH (${onlyInSSHProjects.length}): ${onlyInSSHProjects.join(', ')}`);
  }
  if (onlyInMCPProjects.length === 0 && onlyInSSHProjects.length === 0) {
    console.log(`   ✅ Все проекты найдены в обоих методах`);
  }
  
  // Детальная статистика
  console.log('\n📈 DETAILED STATS:');
  console.log('   MCP Summary:', JSON.stringify(mcpResult.summary, null, 2));
  console.log('   SSH Summary:', JSON.stringify(sshResult.summary, null, 2));
}

async function main() {
  console.log('🚀 Starting MCP vs SSH comparison test...\n');
  
  let mcpResult, sshResult;
  
  try {
    // Тест MCP
    mcpResult = await testMCP();
    console.log(`✅ MCP completed in ${mcpResult.elapsed}ms`);
    console.log(`   Found ${mcpResult.projects.length} projects, ${mcpResult.containers.length} containers`);
    
    // Тест SSH
    sshResult = await testSSH();
    console.log(`✅ SSH completed in ${sshResult.elapsed}ms`);
    console.log(`   Found ${sshResult.projects.length} projects, ${sshResult.containers.length} containers`);
    
    // Сравнение
    compareResults(mcpResult, sshResult);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    cleanupDockerClient();
  }
}

main().catch(console.error);
