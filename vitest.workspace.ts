import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      defineProject({
        extends: './vitest.config.ts',
        test: {
          name: 'mcp-server-unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node'
        }
      }),
      defineProject({
        extends: './vitest.config.ts',
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node'
        }
      })
    ]
  }
});
