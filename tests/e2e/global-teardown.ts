/**
 * Global teardown for E2E tests
 * Запускается один раз после всех тестов
 */

import { globalTeardownE2E } from './setup.js';

export default async function globalTeardown() {
  console.log('\n🧹 Global Teardown: Starting...');
  await globalTeardownE2E();
}
