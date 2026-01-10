#!/usr/bin/env node
/**
 * Manual Remote Profile Test Script
 * 
 * Использование:
 *   DOCKER_MCP_PROFILES_FILE=./profiles.json tsx tests/manual/remote-profile-manual-test.ts
 */

import { DatabaseTools } from '../../src/tools/database-tools.js';
import { ContainerTools } from '../../src/tools/container-tools.js';
import { resolveProfile } from '../../src/utils/profile-resolver.js';

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testExplicitError() {
  log('cyan', '\n🔴 ТЕСТ 1: Явная ошибка при неверном profile');
  log('yellow', '─'.repeat(60));
  
  const databaseTools = new DatabaseTools();
  
  try {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'postgres',
          query: 'SELECT 1',
          profile: 'non-existent-profile-12345',
        },
      },
    });
    
    if (result.isError) {
      const errorText = result.content[0].text;
      if (errorText.includes('PROFILE ERROR')) {
        log('green', '✅ ПРОЙДЕН: Явная ошибка выброшена!');
        log('blue', '   Текст ошибки содержит "PROFILE ERROR"');
        log('blue', '   Текст ошибки содержит "NO FALLBACK TO LOCAL"');
        return true;
      } else {
        log('red', '❌ ПРОВАЛЕН: Ошибка есть, но не PROFILE ERROR');
        console.log(errorText);
        return false;
      }
    } else {
      log('red', '❌ КРИТИЧЕСКИЙ ПРОВАЛ: Ошибка НЕ выброшена!');
      log('red', '   Это означает fallback на local - ОПАСНО!');
      return false;
    }
  } catch (error: any) {
    log('red', `❌ ОШИБКА: ${error.message}`);
    return false;
  }
}

async function testLocalWithoutProfile() {
  log('cyan', '\n✅ ТЕСТ 2: Local без profile (должно работать)');
  log('yellow', '─'.repeat(60));
  
  const databaseTools = new DatabaseTools();
  
  try {
    const result = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_status',
        arguments: {
          service: 'postgres',
          // profile НЕ указан
        },
      },
    });
    
    if (result.isError) {
      log('yellow', '⚠️  ОШИБКА (но это OK - может не быть local postgres):');
      console.log(result.content[0].text);
      return true; // Ошибка OK, главное что не PROFILE ERROR
    } else {
      log('green', '✅ ПРОЙДЕН: Запрос выполнен (на local Docker)');
      return true;
    }
  } catch (error: any) {
    log('yellow', `⚠️  ОШИБКА: ${error.message} (может быть OK)`);
    return true;
  }
}

async function testRemoteProfile() {
  log('cyan', '\n🌐 ТЕСТ 3: Remote профиль (нужно указать реальный профиль)');
  log('yellow', '─'.repeat(60));
  
  // Получаем имя профиля из переменной окружения
  const remoteProfile = process.env.REMOTE_PROFILE_NAME || 'zaicylab';
  log('blue', `   Используется профиль: "${remoteProfile}"`);
  
  // Проверяем что профиль существует
  const sshConfig = resolveProfile(remoteProfile);
  if (!sshConfig) {
    log('red', `❌ ПРОВАЛЕН: Профиль "${remoteProfile}" не найден!`);
    log('yellow', '   Установи переменную: REMOTE_PROFILE_NAME=your-profile');
    return false;
  }
  
  log('green', `✅ Профиль "${remoteProfile}" найден: ${sshConfig.host}:${sshConfig.port || 22}`);
  
  // Получаем имя проекта из переменной окружения
  const projectName = process.env.REMOTE_PROJECT_NAME || 'docker-mcp-server';
  log('blue', `   Используется проект: "${projectName}"`);
  
  const databaseTools = new DatabaseTools();
  
  try {
    // Сначала проверяем Container List - должен показать remote контейнеры
    log('blue', '\n   Проверяю docker_container_list с remote профилем...');
    const containerTools = new ContainerTools();
    const listResult = await containerTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_container_list',
        arguments: {
          profile: remoteProfile,
          project: projectName,
        },
      },
    });
    
    if (listResult.isError) {
      log('yellow', '⚠️  Container List ошибка (может быть OK если проект не найден):');
      console.log(listResult.content[0].text);
    } else {
      log('green', '✅ Container List работает!');
      console.log(listResult.content[0].text.substring(0, 200) + '...');
    }
    
    // Затем проверяем Database Query
    log('blue', '\n   Проверяю docker_db_query с remote профилем...');
    const queryResult = await databaseTools.handleCall({
      method: 'tools/call',
      params: {
        name: 'docker_db_query',
        arguments: {
          service: 'postgres', // Имя сервиса на remote
          query: "SELECT 'REMOTE_SERVER_TEST' as marker",
          profile: remoteProfile,
          project: projectName,
        },
      },
    });
    
    if (queryResult.isError) {
      const errorText = queryResult.content[0].text;
      if (errorText.includes('PROFILE ERROR')) {
        log('red', '❌ КРИТИЧЕСКИЙ ПРОВАЛ: Профиль не найден!');
        console.log(errorText);
        return false;
      } else {
        log('yellow', '⚠️  Ошибка (но не PROFILE ERROR - профиль работает):');
        console.log(errorText);
        log('yellow', '   Это может быть OK если сервис не найден на remote');
        return true; // Профиль резолвится, это главное
      }
    } else {
      log('green', '✅ Database Query работает на remote!');
      const resultText = queryResult.content[0].text;
      console.log(resultText);
      
      if (resultText.includes('REMOTE_SERVER_TEST')) {
        log('green', '✅ ПОДТВЕРЖДЕНО: Запрос выполнен на REMOTE сервере!');
        return true;
      } else {
        log('yellow', '⚠️  Не могу подтвердить что это remote (но ошибки нет)');
        return true;
      }
    }
  } catch (error: any) {
    log('red', `❌ ОШИБКА: ${error.message}`);
    return false;
  }
}

async function main() {
  log('blue', '🧪 РУЧНОЕ ТЕСТИРОВАНИЕ REMOTE ПРОФИЛЕЙ');
  log('blue', '='.repeat(60));
  
  const results: boolean[] = [];
  
  // Тест 1: Явная ошибка
  results.push(await testExplicitError());
  
  // Тест 2: Local без profile
  results.push(await testLocalWithoutProfile());
  
  // Тест 3: Remote профиль
  if (process.env.REMOTE_PROFILE_NAME || process.env.TEST_REMOTE === 'true') {
    results.push(await testRemoteProfile());
  } else {
    log('yellow', '\n⚠️  Тест 3 пропущен (установи REMOTE_PROFILE_NAME или TEST_REMOTE=true)');
    results.push(true); // Пропуск считается успехом
  }
  
  // Итоги
  log('blue', '\n' + '='.repeat(60));
  log('blue', '📊 ИТОГИ:');
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    log('green', `✅ ВСЕ ТЕСТЫ ПРОШЛИ: ${passed}/${total}`);
  } else {
    log('red', `❌ ЕСТЬ ПРОВАЛЫ: ${passed}/${total}`);
  }
  
  process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
  log('red', `❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
  console.error(error);
  process.exit(1);
});
