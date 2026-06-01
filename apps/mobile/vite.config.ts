import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mobile/',
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@admini/ui/styles.css': fileURLToPath(new URL('../../packages/ui/src/styles.css', import.meta.url)),
      '@admini/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '@admini/privacy': fileURLToPath(new URL('../../packages/privacy/src/index.ts', import.meta.url)),
      '@admini/api-client': fileURLToPath(new URL('../../packages/api-client/src/index.ts', import.meta.url)),
      '@admini/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url))
    }
  }
});
