import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    // Allow requests from zenithwell.online and its subdomains
    allowedHosts: [
      'zenithwell.online',
      'www.zenithwell.online',
      'localhost',
    ],
  },
});
