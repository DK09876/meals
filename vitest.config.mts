import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'], testTimeout: 20_000 },
  resolve: { alias: { '@': resolve(import.meta.dirname, '.') } },
});
