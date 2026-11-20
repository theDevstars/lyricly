import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'packages/styles/src/**/*.test.ts',
      'site/src/lib/**/*.test.ts',
    ],
    alias: {
      '@lyrica/styles': new URL('./packages/styles/src/index.ts', import.meta.url).pathname,
    },
    environment: 'node',
  },
});
