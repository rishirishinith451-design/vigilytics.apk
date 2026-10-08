import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'suppress-hmr-client-errors',
        transform(code, id) {
          if (id.includes('@vite/client') || id.includes('vite/dist/client/client.mjs')) {
            // Replace the rejection that causes 'WebSocket closed without opened.' with silent resolve/no-op
            return code.replace(
              'reject(/* @__PURE__ */ new Error("WebSocket closed without opened."));',
              'resolve();'
            );
          }
          return null;
        },
        transformIndexHtml(html) {
          const suppressScript = `<script>
            (function() {
              const origError = console.error;
              console.error = function(...args) {
                const msg = (args[0] && typeof args[0] === 'object' && args[0].message) ? args[0].message : String(args[0] || '');
                if (
                  msg.includes('WebSocket closed without opened') ||
                  msg.includes('[vite]') ||
                  msg.includes('WebSocket') ||
                  msg.includes('connection lost')
                ) {
                  return;
                }
                origError.apply(console, args);
              };
              window.addEventListener('unhandledrejection', function(e) {
                const reason = (e.reason && (e.reason.message || e.reason.toString())) || '';
                if (
                  reason.includes('WebSocket closed without opened') ||
                  reason.includes('[vite]') ||
                  reason.includes('WebSocket')
                ) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              }, true);
              window.addEventListener('error', function(e) {
                const msg = (e.message || '') + (e.error?.message || '');
                if (
                  msg.includes('WebSocket closed without opened') ||
                  msg.includes('[vite]') ||
                  msg.includes('WebSocket')
                ) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              }, true);
            })();
          </script>`;
          return html.replace('<head>', '<head>' + suppressScript);
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Vigilytics - Pharmacovigilance Intelligence',
          short_name: 'Vigilytics',
          description: 'Enterprise pharmacovigilance decision-support platform for adverse drug reaction monitoring, causality assessment, and safety signal escalation.',
          theme_color: '#4f46e5',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          categories: ['medical', 'health', 'productivity'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
