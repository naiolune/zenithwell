import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'zenithwell.online',
      'www.zenithwell.online',
      'localhost',
    ],
  },
});
