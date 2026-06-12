import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: {
    postcss: {},
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
