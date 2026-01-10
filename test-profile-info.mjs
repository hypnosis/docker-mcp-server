#!/usr/bin/env node
/**
 * Тестовый скрипт для docker_profile_info
 */

import { ProfileTool } from './dist/tools/profile-tool.js';

async function testProfileInfo() {
  console.log('🧪 Тестирую docker_profile_info...\n');
  
  const tool = new ProfileTool();
  
  try {
    const request = {
      params: {
        name: 'docker_profile_info',
        arguments: {}
      }
    };
    
    const result = await tool.handleCall(request);
    
    console.log('✅ РЕЗУЛЬТАТ:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.isError) {
      console.log('\n❌ ОШИБКА!');
      process.exit(1);
    } else {
      console.log('\n✅ УСПЕХ!');
    }
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
  }
}

testProfileInfo();
