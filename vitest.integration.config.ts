import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env file
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
      testTimeout: 30000, // 30s timeout for API calls
      hookTimeout: 30000,
      // Integration tests run sequentially to avoid rate limiting
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      env,
    },
  };
});
