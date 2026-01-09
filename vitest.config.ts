import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts', // Entry point, difficult to test
      ],
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/mcp-tools.test.ts'], // Основной файл - только для ручного запуска
  },
  resolve: {
    // For proper ESM and TypeScript support
    extensions: ['.ts', '.js'],
  },
});

