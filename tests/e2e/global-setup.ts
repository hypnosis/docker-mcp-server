/**
 * Global setup for E2E tests
 * Запускается один раз перед всеми тестами
 */

import { globalSetupE2E } from './setup.js';

export default async function globalSetup() {
  await globalSetupE2E();
}
