import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/mobile/',
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [
    react(),
    {
      name: 'admini-mobile-slash-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/mobile') {
            res.statusCode = 301;
            res.setHeader('Location', '/mobile/');
            res.end();
            return;
          }
          next();
        });
      }
    },
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/mobile/offline.html',
        navigateFallbackDenylist: [/^\/mobile\/api\//]
      },
      manifest: {
        name: 'AdminI Mobile',
        short_name: 'AdminI',
        display: 'standalone',
        start_url: '/mobile/',
        scope: '/mobile/',
        theme_color: '#1a1a2e',
        background_color: '#f7f8fa',
        icons: [
          { src: '/mobile/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/mobile/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@admini/ui/styles.css': fileURLToPath(new URL('../../packages/ui/src/styles.css', import.meta.url)),
      '@admini/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '@admini/privacy': fileURLToPath(new URL('../../packages/privacy/src/index.ts', import.meta.url)),
      '@admini/api-client': fileURLToPath(new URL('../../packages/api-client/src/index.ts', import.meta.url)),
      '@admini/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      '@admini/workspace': fileURLToPath(new URL('../../packages/workspace/src/index.ts', import.meta.url)),
      '@admini/pwa': fileURLToPath(new URL('../../packages/pwa/src/index.ts', import.meta.url))
    }
  }
});
