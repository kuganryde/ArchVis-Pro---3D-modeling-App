import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/shared/**', 'serverSecurity.ts', 'serverApp.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
