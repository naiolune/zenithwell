module.exports = {
  apps: [
    {
      name: 'zenithwell',
      script: 'npm',
      args: 'start',
      cwd: '/home/kitsune/zenithwell',
      instances: 1, // Use single instance
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      // Logging - Remove custom log paths to use PM2 defaults
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Process management
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Health monitoring
      watch: false, // Set to true for development
      ignore_watch: ['node_modules', 'logs', '.next'],
      
      // Advanced features
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Auto restart on file changes (development only)
      watch_options: {
        followSymlinks: false
      }
    }
  ],

  deploy: {
    production: {
      user: 'kitsune',
      host: 'localhost',
      ref: 'origin/master',
      repo: 'git@github.com:your-username/zenithwell.git', // Update with your actual repo
      path: '/home/kitsune/zenithwell',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};