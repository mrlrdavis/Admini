import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    root: __dirname,
    environment: 'jsdom',
    globals: true,
    css: false,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
