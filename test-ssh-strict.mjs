#!/usr/bin/env node
/**
 * Тест строгой проверки SSH ключей
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadProfilesFile, profileDataToSSHConfig } from './dist/utils/profiles-file.js';
import { DockerClient } from './dist/utils/docker-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testProfile(profileName) {
  console.log(`\n🧪 Тестирую профиль: ${profileName}`);
  console.log('='.repeat(60));
  
  try {
    // Загружаем профиль
    const profilesFile = join(homedir(), '.cursor', 'docker-profiles.json');
    console.log(`📁 Загружаю профили из: ${profilesFile}`);
    
    const result = loadProfilesFile(profilesFile);
    
    if (result.errors.length > 0) {
      console.error('❌ Ошибки при загрузке профилей:', result.errors);
      return;
    }
    
    const profileData = result.config?.profiles[profileName];
    if (!profileData) {
      console.error(`❌ Профиль "${profileName}" не найден!`);
      console.log(`Доступные профили: ${Object.keys(result.config?.profiles || {}).join(', ')}`);
      return;
    }
    
    console.log(`✅ Профиль найден:`, JSON.stringify(profileData, null, 2));
    
    // Преобразуем в SSHConfig
    if (profileData.mode === 'local') {
      console.log('ℹ️  Локальный профиль, SSH не требуется');
      return;
    }
    
    const sshConfig = profileDataToSSHConfig(profileData);
    console.log(`🔑 SSH Config:`, {
      host: sshConfig.host,
      username: sshConfig.username,
      privateKeyPath: sshConfig.privateKeyPath
    });
    
    // Пытаемся создать DockerClient (здесь должна быть ошибка если ключ не найден)
    console.log('\n🔄 Создаю DockerClient...');
    const client = new DockerClient(sshConfig);
    
    console.log('⚠️  DockerClient создан, но ошибка будет при создании туннеля');
    console.log('🔄 Пытаюсь создать SSH туннель (ping)...');
    
    await client.ping();
    console.log('✅ Успешно подключились!');
    
  } catch (error) {
    console.error('\n❌ ОШИБКА (как и ожидалось для плохого ключа):');
    console.error(error.message);
    console.error('\n📋 Полный stack trace:');
    console.error(error.stack);
    return false;
  }
  
  return true;
}

// Тестируем
console.log('🚀 ТЕСТ СТРОГОЙ ПРОВЕРКИ SSH КЛЮЧЕЙ');
console.log('='.repeat(60));

const profileName = process.argv[2] || 'test-bad-key';
testProfile(profileName)
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
