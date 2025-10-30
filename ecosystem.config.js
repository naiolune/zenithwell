module.exports = {
  apps: [
    {
      name: 'zenithwell',
      script: './node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/home/kitsune/zenithwell',
      instances: 1,
      exec_mode: 'fork', // Use fork mode for better log capture
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        NEXT_PUBLIC_SITE_URL: 'https://zenithwell.online',
        SITE_URL: 'https://zenithwell.online'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        NEXT_PUBLIC_SITE_URL: 'https://zenithwell.online',
        SITE_URL: 'https://zenithwell.online'
      },
      // Logging configuration - all logs go to PM2 log files, not console
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      output: '/home/kitsune/.pm2/logs/zenithwell-out.log',
      error: '/home/kitsune/.pm2/logs/zenithwell-error.log',
      disable_logs: false,
      autorestart: true,
      
      // Process management
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Health monitoring
      watch: false, // Set to true for development
      ignore_watch: ['node_modules', 'logs', '.next'],
      
      // Advanced features
      kill_timeout: 5000,
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