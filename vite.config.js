import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config: bundles React + JSX at build time (no CDN, no Babel-Standalone),
// emits hashed assets, copies /public/* (incl. fonts) to dist/.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3009,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      // Forward /api/* to the Fastify backend so the browser sees same-origin
      // cookies in dev. Production goes through Caddy with the same path-based
      // routing — the frontend code never needs to know which is in use.
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: false,
      },
    },
  },
  preview: { port: 3009, host: '0.0.0.0', strictPort: true },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Group React separately so the vendor bundle is cacheable across deploys.
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  plugins: [react()],
});
