import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/desktop/',
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [
    react(),
    {
      name: 'admini-desktop-slash-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/desktop') {
            res.statusCode = 301;
            res.setHeader('Location', '/desktop/');
            res.end();
            return;
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@admini/ui/styles.css': fileURLToPath(new URL('../../packages/ui/src/styles.css', import.meta.url)),
      '@admini/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '@admini/privacy': fileURLToPath(new URL('../../packages/privacy/src/index.ts', import.meta.url)),
      '@admini/api-client': fileURLToPath(new URL('../../packages/api-client/src/index.ts', import.meta.url)),
      '@admini/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      '@admini/integrations': fileURLToPath(new URL('../../packages/integrations/src/index.ts', import.meta.url))
    }
  }
});
