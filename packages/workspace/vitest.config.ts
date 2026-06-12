import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@admini/ui/styles.css': fileURLToPath(new URL('../ui/src/styles.css', import.meta.url)),
      '@admini/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      '@admini/ui': fileURLToPath(new URL('../ui/src/index.ts', import.meta.url)),
      xlsx: fileURLToPath(new URL('./__mocks__/xlsx.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
