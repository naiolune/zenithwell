import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    // Allow all hosts - Vite security check
    allowedHosts: true,
    strictPort: false,
    hmr: {
      host: 'zenithwell.online',
      protocol: 'ws',
    },
  },
  preview: {
    host: '0.0.0.0',
    // Required for Vite 6.0.9+ when accessing with hostname other than localhost
    allowedHost: true,
    strictPort: false,
  },
});
