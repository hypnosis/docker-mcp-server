import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // Глобальный setup/teardown для всех E2E тестов
    globalSetup: resolve(process.cwd(), 'tests/e2e/global-setup.ts'),
    globalTeardown: resolve(process.cwd(), 'tests/e2e/global-teardown.ts'),
    testTimeout: 60000, // 60 секунд на тест
    hookTimeout: 120000, // 2 минуты на setup/teardown
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
