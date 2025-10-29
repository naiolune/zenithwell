# ZenithWell Deployment Guide

This guide covers the complete setup of nginx and PM2 for the ZenithWell Next.js application.

## Prerequisites

- Ubuntu/Debian Linux server
- Node.js 18+ installed
- npm installed
- Git (if using version control)
- Domain name configured (for SSL)

## Quick Start

1. **Run the deployment script:**
   ```bash
   ./deploy.sh
   ```

2. **Access your application:**
   - Local: `http://localhost:3000`
   - Via nginx: `http://your-domain.com` (after DNS setup)

## Manual Setup

### 1. Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### 2. Install and Configure Nginx

```bash
# Install nginx
sudo apt update
sudo apt install -y nginx

# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/zenithwell

# Enable the site
sudo ln -s /etc/nginx/sites-available/zenithwell /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 3. Configure SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 4. Start the Application

```bash
# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Configuration Files

### PM2 Configuration (`ecosystem.config.js`)

- **Cluster Mode**: Uses all available CPU cores
- **Memory Limit**: Restarts if memory usage exceeds 1GB
- **Logging**: Centralized logging in `/logs` directory
- **Auto-restart**: Automatically restarts on crashes

### Nginx Configuration (`nginx.conf`)

- **SSL/TLS**: Secure HTTPS configuration
- **Security Headers**: CSP, HSTS, XSS protection
- **Rate Limiting**: API and auth endpoint protection
- **Gzip Compression**: Optimized content delivery
- **Static File Caching**: Long-term caching for assets

## Management Commands

### Using the Deployment Script

```bash
# Full deployment
./deploy.sh deploy

# Update application
./deploy.sh update

# Start/stop/restart
./deploy.sh start
./deploy.sh stop
./deploy.sh restart

# Check status
./deploy.sh status

# View logs
./deploy.sh logs
```

### Using PM2 Commands

```bash
# Quick PM2 operations
./pm2-commands.sh start
./pm2-commands.sh stop
./pm2-commands.sh restart
./pm2-commands.sh status
./pm2-commands.sh logs
./pm2-commands.sh monit
```

### Direct PM2 Commands

```bash
# Process management
pm2 start ecosystem.config.js --env production
pm2 stop zenithwell
pm2 restart zenithwell
pm2 reload zenithwell  # Zero-downtime reload
pm2 delete zenithwell

# Monitoring
pm2 status
pm2 logs zenithwell
pm2 monit

# Configuration
pm2 save
pm2 resurrect
pm2 startup
```

## Monitoring and Logs

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Process status
pm2 status

# Detailed process info
pm2 show zenithwell
```

### Log Files

- **Application Logs**: `/home/kitsune/zenithwell/logs/`
  - `combined.log` - All logs
  - `out.log` - Standard output
  - `error.log` - Error logs

- **Nginx Logs**: `/var/log/nginx/`
  - `access.log` - Access logs
  - `error.log` - Error logs

### Viewing Logs

```bash
# PM2 logs
pm2 logs zenithwell
pm2 logs zenithwell --lines 100
pm2 logs zenithwell --follow

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Application logs
tail -f /home/kitsune/zenithwell/logs/combined.log
```

## Security Considerations

### Firewall Configuration

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### SSL/TLS Security

- Uses TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS headers enabled
- Perfect Forward Secrecy

### Rate Limiting

- API endpoints: 10 requests/second
- Auth endpoints: 5 requests/minute
- Burst handling with nodelay

### Security Headers

- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security

## Performance Optimization

### PM2 Cluster Mode

- Utilizes all CPU cores
- Automatic load balancing
- Process isolation
- Zero-downtime deployments

### Nginx Optimizations

- Gzip compression
- Static file caching
- Connection pooling
- Buffer optimization

### Next.js Optimizations

- Production build
- Static file serving
- Image optimization
- Code splitting

## Troubleshooting

### Common Issues

1. **Port 3000 already in use**
   ```bash
   # Find process using port 3000
   sudo lsof -i :3000
   
   # Kill the process
   sudo kill -9 <PID>
   ```

2. **Nginx configuration errors**
   ```bash
   # Test nginx configuration
   sudo nginx -t
   
   # Check nginx error logs
   sudo tail -f /var/log/nginx/error.log
   ```

3. **PM2 process not starting**
   ```bash
   # Check PM2 logs
   pm2 logs zenithwell
   
   # Check process details
   pm2 show zenithwell
   ```

4. **SSL certificate issues**
   ```bash
   # Check certificate status
   sudo certbot certificates
   
   # Renew certificate
   sudo certbot renew
   ```

### Health Checks

```bash
# Check if application is running
curl -I http://localhost:3000/health

# Check nginx status
sudo systemctl status nginx

# Check PM2 status
pm2 status
```

## Maintenance

### Regular Tasks

1. **Update dependencies**
   ```bash
   npm update
   npm run build
   pm2 reload zenithwell
   ```

2. **Monitor disk space**
   ```bash
   df -h
   du -sh /home/kitsune/zenithwell/logs/
   ```

3. **Rotate logs**
   ```bash
   # PM2 log rotation (automatic)
   pm2 install pm2-logrotate
   
   # Nginx log rotation (automatic with logrotate)
   sudo logrotate -f /etc/logrotate.d/nginx
   ```

### Backup

```bash
# Backup application
tar -czf zenithwell-backup-$(date +%Y%m%d).tar.gz /home/kitsune/zenithwell

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 /home/kitsune/zenithwell-backup/
```

## Environment Variables

Make sure to set the following environment variables:

```bash
# Database
DATABASE_URL=your_database_url

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# AI Services
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
PERPLEXITY_API_KEY=your_perplexity_key
```

## Support

For issues or questions:

1. Check the logs first
2. Verify configuration files
3. Test individual components
4. Check system resources
5. Review security settings

## Next Steps

After successful deployment:

1. Configure monitoring (e.g., New Relic, DataDog)
2. Set up automated backups
3. Configure log aggregation
4. Implement CI/CD pipeline
5. Set up alerting