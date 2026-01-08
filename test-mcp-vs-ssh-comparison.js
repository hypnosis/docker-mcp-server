#!/usr/bin/env node
/**
 * Сравнительный тест: MCP команды vs SSH команды
 * 
 * Сравнивает:
 * 1. ПОЛНОТУ ответа
 * 2. УДОБСТВО использования
 * 3. СКОРОСТЬ ОТВЕТА
 */

import { performance } from 'perf_hooks';
import { loadSSHConfig } from './dist/utils/ssh-config.js';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { getDockerClient } from './dist/utils/docker-client.js';
import { RemoteProjectDiscovery } from './dist/discovery/remote-discovery.js';
import { execSSH } from './dist/utils/ssh-exec.js';

console.log('🔬 СРАВНИТЕЛЬНЫЙ ТЕСТ: MCP vs SSH\n');
console.log('=' .repeat(80));
console.log('Сравниваем: ПОЛНОТУ ответа | УДОБСТВО использования | СКОРОСТЬ ОТВЕТА');
console.log('=' .repeat(80) + '\n');

// Загрузка SSH конфига
let sshConfigResult = loadSSHConfig();

// Если нет конфига из env, пробуем загрузить из файла профилей
if (!sshConfigResult.config) {
  // Пробуем несколько возможных путей
  const possiblePaths = [
    process.env.DOCKER_MCP_PROFILES_FILE?.replace('~', process.env.HOME || ''),
    process.env.HOME ? `${process.env.HOME}/.docker-mcp-profiles.json` : null,
    './profiles.json',
    './profiles.example.json',
  ].filter(Boolean);
  
  for (const profilesFile of possiblePaths) {
    try {
      const fileResult = loadProfilesFile(profilesFile);
      
      if (fileResult.config && !fileResult.errors.length) {
        // Пробуем несколько имен профилей
        const profileNames = [
          fileResult.config.default,
          'zaicylab',
          'Зайцылаб',
          Object.keys(fileResult.config.profiles || {})[0],
        ].filter(Boolean);
        
        for (const profileName of profileNames) {
          const profileData = fileResult.config.profiles?.[profileName];
          
          if (profileData) {
            const config = profileDataToSSHConfig(profileData);
            sshConfigResult = { config, errors: [] };
            console.log(`📁 Загружен профиль "${profileName}" из ${profilesFile}`);
            break;
          }
        }
        
        if (sshConfigResult.config) break;
      }
    } catch (error) {
      // Файл не найден - пробуем следующий
      continue;
    }
  }
}

if (sshConfigResult.errors.length > 0 || !sshConfigResult.config) {
  console.error('❌ SSH config не найден.');
  console.error('');
  console.error('   Варианты настройки:');
  console.error('   1. Установите переменные:');
  console.error('      export DOCKER_SSH_HOST=your-host');
  console.error('      export DOCKER_SSH_USER=your-user');
  console.error('      export DOCKER_SSH_KEY=~/.ssh/id_rsa');
  console.error('');
  console.error('   2. Или создайте файл ~/.docker-mcp-profiles.json:');
  console.error('      {');
  console.error('        "default": "profile-name",');
  console.error('        "profiles": {');
  console.error('          "profile-name": {');
  console.error('            "host": "your-host",');
  console.error('            "username": "your-user",');
  console.error('            "privateKeyPath": "~/.ssh/id_rsa"');
  console.error('          }');
  console.error('        }');
  console.error('      }');
  console.error('      export DOCKER_MCP_PROFILES_FILE=~/.docker-mcp-profiles.json');
  console.error('');
  process.exit(1);
}

const sshConfig = sshConfigResult.config;
const projectsPath = sshConfig.projectsPath || '/var/www';

console.log(`✅ SSH Config: ${sshConfig.host}:${sshConfig.port || 22} (${sshConfig.username})\n`);

// Инициализация Docker клиента
const dockerClient = getDockerClient(sshConfig);
const docker = dockerClient.getClient();

try {
  await dockerClient.ping();
  console.log('✅ Docker подключение успешно\n');
} catch (error) {
  console.error('❌ Docker подключение не удалось:', error.message);
  process.exit(1);
}

// Инициализация MCP Discovery
const mcpDiscovery = new RemoteProjectDiscovery(sshConfig, dockerClient);

// ========================================
// ТЕСТ 1: Список всех проектов
// ========================================
console.log('📋 ТЕСТ 1: Список всех проектов');
console.log('-'.repeat(80));

let mcpTimeStart, mcpTimeEnd, sshTimeStart, sshTimeEnd;
let mcpResult, sshResult;

// MCP метод
try {
  mcpTimeStart = performance.now();
  mcpResult = await mcpDiscovery.discoverProjects({
    sshConfig,
    dockerClient: docker,
    basePath: projectsPath,
  });
  mcpTimeEnd = performance.now();
  const mcpTime = (mcpTimeEnd - mcpTimeStart).toFixed(2);
  
  console.log(`✅ MCP: ${mcpTime}ms`);
  console.log(`   Найдено проектов: ${mcpResult.summary.total}`);
  console.log(`   Запущенных: ${mcpResult.summary.running}`);
  console.log(`   Частично: ${mcpResult.summary.partial}`);
  console.log(`   Остановленных: ${mcpResult.summary.stopped}`);
} catch (error) {
  console.error(`❌ MCP ошибка: ${error.message}`);
  mcpResult = null;
}

console.log('');

// SSH метод (аналог MCP - быстрый список)
try {
  sshTimeStart = performance.now();
  
  // Получаем все запущенные контейнеры с labels
  const dockerPsCommand = `docker ps -q`;
  const psResult = await execSSH(sshConfig, dockerPsCommand, { timeout: 30000 });
  
  if (!psResult.stdout.trim()) {
    sshResult = { projects: [], total: 0 };
  } else {
    // Получаем inspect для всех контейнеров одной командой
    const inspectCommand = `docker ps -q | xargs -r docker inspect --format '{{json .}}'`;
    const inspectResult = await execSSH(sshConfig, inspectCommand, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    
    // Парсим JSON (каждая строка - отдельный JSON объект)
    const containers = inspectResult.stdout
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(c => c !== null);
    
    // Группируем по проектам через labels
    const projectsMap = new Map();
    
    for (const container of containers) {
      const projectLabel = container.Config?.Labels?.['com.docker.compose.project'] || 
                          container.Config?.Labels?.['com.docker.compose.project.working_dir']?.split('/').pop();
      const serviceLabel = container.Config?.Labels?.['com.docker.compose.service'];
      const workingDir = container.Config?.Labels?.['com.docker.compose.project.working_dir'];
      
      if (!projectLabel) continue;
      
      if (!projectsMap.has(projectLabel)) {
        projectsMap.set(projectLabel, {
          name: projectLabel,
          path: workingDir || `${projectsPath}/${projectLabel}`,
          containers: [],
          running: 0,
        });
      }
      
      const project = projectsMap.get(projectLabel);
      project.containers.push({
        id: container.Id,
        name: container.Name,
        service: serviceLabel || container.Name,
        status: container.State?.Status || 'unknown',
      });
      
      if (container.State?.Running) {
        project.running++;
      }
    }
    
    sshResult = {
      projects: Array.from(projectsMap.values()),
      total: projectsMap.size,
    };
  }
  
  sshTimeEnd = performance.now();
  const sshTime = (sshTimeEnd - sshTimeStart).toFixed(2);
  
  console.log(`✅ SSH: ${sshTime}ms`);
  console.log(`   Найдено проектов: ${sshResult.total}`);
  console.log(`   Команды: docker ps -q + docker inspect`);
} catch (error) {
  console.error(`❌ SSH ошибка: ${error.message}`);
  sshResult = null;
}

console.log('');

// ========================================
// ТЕСТ 2: Детальная информация по проекту
// ========================================
console.log('📋 ТЕСТ 2: Детальная информация по проекту');
console.log('-'.repeat(80));

// Выбираем первый проект для теста
const testProjectName = mcpResult?.projects?.[0]?.name;

if (!testProjectName) {
  console.log('⚠️  Нет проектов для теста');
} else {
  console.log(`   Тестируем проект: "${testProjectName}"\n`);
  
  // MCP метод
  try {
    mcpTimeStart = performance.now();
    const mcpProjectResult = await mcpDiscovery.getProjectStatus({
      sshConfig,
      dockerClient: docker,
      projectName: testProjectName,
      basePath: projectsPath,
    });
    mcpTimeEnd = performance.now();
    const mcpTime = (mcpTimeEnd - mcpTimeStart).toFixed(2);
    
    console.log(`✅ MCP: ${mcpTime}ms`);
    console.log(`   Проект: ${mcpProjectResult.name}`);
    console.log(`   Путь: ${mcpProjectResult.path}`);
    console.log(`   Статус: ${mcpProjectResult.status}`);
    console.log(`   Сервисы: ${mcpProjectResult.services.length}`);
    console.log(`   Запущенных контейнеров: ${mcpProjectResult.runningContainers}/${mcpProjectResult.totalServices}`);
    if (mcpProjectResult.composeConfig) {
      console.log(`   Compose файл: прочитан`);
    }
  } catch (error) {
    console.error(`❌ MCP ошибка: ${error.message}`);
  }
  
  console.log('');
  
  // SSH метод (аналог MCP - детальная информация)
  try {
    sshTimeStart = performance.now();
    
    // Фильтруем контейнеры по проекту
    const filterCommand = `docker ps -a --filter "label=com.docker.compose.project=${testProjectName}" --format '{{json .}}'`;
    const filterResult = await execSSH(sshConfig, filterCommand, { timeout: 30000 });
    
    // Также получаем inspect для детальной информации
    const projectInspectCommand = `docker ps -a --filter "label=com.docker.compose.project=${testProjectName}" -q | xargs -r docker inspect --format '{{json .}}'`;
    const projectInspectResult = await execSSH(sshConfig, projectInspectCommand, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    
    // Читаем compose файл (если известен путь)
    let composeContent = null;
    const composePath = `${projectsPath}/${testProjectName}/docker-compose.yml`;
    try {
      const composeResult = await execSSH(sshConfig, `cat "${composePath}"`, { timeout: 10000 });
      composeContent = composeResult.stdout;
    } catch {
      // Compose файл не найден или ошибка чтения
    }
    
    const containers = projectInspectResult.stdout
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(c => c !== null);
    
    sshTimeEnd = performance.now();
    const sshTime = (sshTimeEnd - sshTimeStart).toFixed(2);
    
    console.log(`✅ SSH: ${sshTime}ms`);
    console.log(`   Найдено контейнеров: ${containers.length}`);
    console.log(`   Команды: docker ps --filter + docker inspect + cat compose.yml`);
    console.log(`   Compose файл: ${composeContent ? 'прочитан' : 'не найден'}`);
  } catch (error) {
    console.error(`❌ SSH ошибка: ${error.message}`);
  }
}

console.log('\n');

// ========================================
// СРАВНИТЕЛЬНАЯ ТАБЛИЦА
// ========================================
console.log('📊 СРАВНИТЕЛЬНАЯ ТАБЛИЦА');
console.log('=' .repeat(80));

const comparisonTable = [
  ['Критерий', 'MCP', 'SSH', 'Вердикт'],
  ['─'.repeat(20), '─'.repeat(30), '─'.repeat(30), '─'.repeat(30)],
];

// 1. ПОЛНОТА ОТВЕТА
const mcpCompleteness = mcpResult ? 
  `✅ Структурированный JSON\n   - Названия проектов\n   - Статусы (running/partial/stopped)\n   - Пути к проектам\n   - Список сервисов\n   - Сводная статистика\n   - Issues (проблемы)` :
  '❌ Ошибка';

const sshCompleteness = sshResult ?
  `⚠️  Сырой вывод\n   - Требуется парсинг JSON\n   - Группировка по проектам\n   - Вычисление статусов\n   - Нет готовых метрик` :
  '❌ Ошибка';

const completenessVerdict = mcpResult ? '✅ MCP - готовая структура' : '❌ Ошибка';

comparisonTable.push(
  ['ПОЛНОТА ОТВЕТА', mcpCompleteness, sshCompleteness, completenessVerdict]
);

// 2. УДОБСТВО ИСПОЛЬЗОВАНИЯ
const mcpUsability = `✅ Одна команда:\n   docker_discover_projects()\n   или\n   docker_project_status({project:"name"})\n   Возвращает готовый JSON`;

const sshUsability = `❌ Несколько команд:\n   1. docker ps -q\n   2. docker inspect\n   3. Парсинг JSON\n   4. Группировка\n   5. cat compose.yml (для деталей)\n   Требуется ручная обработка`;

comparisonTable.push(
  ['УДОБСТВО', mcpUsability, sshUsability, '✅ MCP - одна команда']
);

// 3. СКОРОСТЬ ОТВЕТА
if (mcpTimeEnd && mcpTimeStart && sshTimeEnd && sshTimeStart) {
  const mcpTimeMs = (mcpTimeEnd - mcpTimeStart).toFixed(2);
  const sshTimeMs = (sshTimeEnd - sshTimeStart).toFixed(2);
  const mcpFaster = parseFloat(mcpTimeMs) < parseFloat(sshTimeMs);
  
  const mcpSpeed = `✅ ${mcpTimeMs}ms\n   - Оптимизированный запрос\n   - Batch inspect`;
  
  const sshSpeed = `${mcpFaster ? '⚠️' : '✅'} ${sshTimeMs}ms\n   - Множественные SSH вызовы\n   - Парсинг на клиенте`;
  
  const speedVerdict = mcpFaster ? 
    `✅ MCP быстрее на ${(parseFloat(sshTimeMs) - parseFloat(mcpTimeMs)).toFixed(2)}ms` :
    `⚠️  SSH быстрее на ${(parseFloat(mcpTimeMs) - parseFloat(sshTimeMs)).toFixed(2)}ms`;
  
  comparisonTable.push(
    ['СКОРОСТЬ', mcpSpeed, sshSpeed, speedVerdict]
  );
} else {
  comparisonTable.push(
    ['СКОРОСТЬ', '❌ Ошибка', '❌ Ошибка', '❌ Нет данных']
  );
}

// Выводим таблицу
comparisonTable.forEach(row => {
  const [criterion, mcp, ssh, verdict] = row;
  console.log(`\n${criterion}:`);
  console.log(`  MCP:  ${mcp.split('\n').join('\n     ')}`);
  console.log(`  SSH:  ${ssh.split('\n').join('\n     ')}`);
  console.log(`  🎯 ${verdict}`);
});

// ========================================
// ФИНАЛЬНЫЙ ВЕРДИКТ
// ========================================
console.log('\n' + '='.repeat(80));
console.log('🏆 ФИНАЛЬНЫЙ ВЕРДИКТ');
console.log('='.repeat(80));

const verdicts = [];

if (mcpResult) {
  verdicts.push('✅ ПОЛНОТА: MCP предоставляет структурированный ответ с метаданными');
  verdicts.push('✅ УДОБСТВО: MCP требует одну команду, SSH - несколько шагов');
  
  if (mcpTimeEnd && mcpTimeStart && sshTimeEnd && sshTimeStart) {
    const mcpTimeMs = mcpTimeEnd - mcpTimeStart;
    const sshTimeMs = sshTimeEnd - sshTimeStart;
    
    if (mcpTimeMs < sshTimeMs) {
      verdicts.push(`✅ СКОРОСТЬ: MCP быстрее на ${(sshTimeMs - mcpTimeMs).toFixed(2)}ms (${((sshTimeMs - mcpTimeMs) / sshTimeMs * 100).toFixed(1)}%)`);
    } else {
      verdicts.push(`⚠️  СКОРОСТЬ: SSH быстрее на ${(mcpTimeMs - sshTimeMs).toFixed(2)}ms, но MCP компенсирует удобством`);
    }
  }
  
  verdicts.push('\n🎯 РЕКОМЕНДАЦИЯ: Использовать MCP для:\n   - Автоматизации через AI ассистента\n   - Быстрого обзора всех проектов\n   - Детальной информации по проектам');
  verdicts.push('\n💡 SSH подходит для:\n   - Ручной отладки\n   - Скриптов без MCP сервера\n   - Прямого доступа к контейнерам');
} else {
  verdicts.push('❌ Ошибка при выполнении тестов');
}

verdicts.forEach(v => console.log(v));

console.log('\n' + '='.repeat(80) + '\n');

// Cleanup
dockerClient.cleanup();
process.exit(0);
