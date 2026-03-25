import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    clearMocks: true,
    restoreMocks: true,
    pool: 'threads',
    maxWorkers: 2,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      include: ['mcp-server/src/**/*.ts', 'websocket-server/src/**/*.ts'],
      exclude: ['mcp-server/src/**/*.d.ts', 'mcp-server/src/**/index.ts'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90
      }
    }
  }
});
