#!/bin/bash

# ZenithWell Setup Script for Linux
# This script sets up the development environment for ZenithWell

set -e  # Exit on any error

echo "🚀 Setting up ZenithWell development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script is designed for Linux systems only."
    exit 1
fi

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_warning "Running as root is not recommended. Please run as a regular user."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update package lists
print_status "Updating package lists..."
sudo apt update

# Install Node.js 20.x
print_status "Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_warning "Node.js version $NODE_VERSION detected. Upgrading to 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        print_success "Node.js $(node --version) is already installed"
    fi
fi

# Install npm if not present
if ! command -v npm &> /dev/null; then
    print_status "Installing npm..."
    sudo apt-get install -y npm
fi

# Install additional dependencies
print_status "Installing additional system dependencies..."
sudo apt-get install -y \
    build-essential \
    curl \
    git \
    wget \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install PostgreSQL (for local development if needed)
print_status "Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Git (if not already installed)
if ! command -v git &> /dev/null; then
    print_status "Installing Git..."
    sudo apt-get install -y git
fi

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    print_warning "Not in a Git repository. Initializing Git..."
    git init
    git add .
    git commit -m "Initial commit"
fi

# Install project dependencies
print_status "Installing project dependencies..."
npm install

# Install additional development tools
print_status "Installing development tools..."
npm install -g \
    typescript \
    @types/node \
    ts-node \
    nodemon \
    pm2

# Create environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local file..."
    cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here

# AI Provider API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Next.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
EOF
    print_warning "Please update .env.local with your actual API keys and configuration values."
else
    print_success ".env.local already exists"
fi

# Create database setup script
print_status "Creating database setup script..."
cat > setup-database.sh << 'EOF'
#!/bin/bash

# Database setup script for ZenithWell
echo "Setting up database..."

# Check if PostgreSQL is running
if ! sudo systemctl is-active --quiet postgresql; then
    echo "Starting PostgreSQL..."
    sudo systemctl start postgresql
fi

# Create database and user
sudo -u postgres psql << 'EOSQL'
-- Create database
CREATE DATABASE zenithwell;

-- Create user
CREATE USER zenithwell_user WITH PASSWORD 'zenithwell_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE zenithwell TO zenithwell_user;

-- Connect to the database and grant schema privileges
\c zenithwell;
GRANT ALL ON SCHEMA public TO zenithwell_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zenithwell_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zenithwell_user;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zenithwell_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zenithwell_user;
EOSQL

echo "Database setup complete!"
echo "Database: zenithwell"
echo "User: zenithwell_user"
echo "Password: zenithwell_password"
EOF

chmod +x setup-database.sh

# Create PM2 ecosystem file for production
print_status "Creating PM2 ecosystem file..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'zenithwell',
    script: 'npm',
    args: 'start',
    cwd: './',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Create systemd service file
print_status "Creating systemd service file..."
sudo tee /etc/systemd/system/zenithwell.service > /dev/null << EOF
[Unit]
Description=ZenithWell Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Create nginx configuration template
print_status "Creating nginx configuration template..."
cat > nginx.conf.template << 'EOF'
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Create deployment script
print_status "Creating deployment script..."
cat > deploy.sh << 'EOF'
#!/bin/bash

# ZenithWell Deployment Script
echo "🚀 Deploying ZenithWell..."

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build the application
npm run build

# Restart the service
sudo systemctl restart zenithwell

echo "✅ Deployment complete!"
EOF

chmod +x deploy.sh

# Create backup script
print_status "Creating backup script..."
cat > backup.sh << 'EOF'
#!/bin/bash

# ZenithWell Backup Script
BACKUP_DIR="/var/backups/zenithwell"
DATE=$(date +%Y%m%d_%H%M%S)

echo "📦 Creating backup..."

# Create backup directory
sudo mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump zenithwell > $BACKUP_DIR/database_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/application_$DATE.tar.gz --exclude=node_modules --exclude=.next .

echo "✅ Backup created: $BACKUP_DIR/application_$DATE.tar.gz"
echo "✅ Database backup: $BACKUP_DIR/database_$DATE.sql"
EOF

chmod +x backup.sh

# Create health check script
print_status "Creating health check script..."
cat > health-check.sh << 'EOF'
#!/bin/bash

# ZenithWell Health Check Script
echo "🔍 Checking ZenithWell health..."

# Check if the application is running
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Application is running"
else
    echo "❌ Application is not responding"
    exit 1
fi

# Check database connection
if sudo -u postgres psql -d zenithwell -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database is accessible"
else
    echo "❌ Database is not accessible"
    exit 1
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo "✅ Disk space is sufficient ($DISK_USAGE% used)"
else
    echo "⚠️  Disk space is low ($DISK_USAGE% used)"
fi

echo "✅ Health check complete!"
EOF

chmod +x health-check.sh

# Build the application
print_status "Building the application..."
npm run build

# Set up Git hooks
print_status "Setting up Git hooks..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for ZenithWell

echo "Running pre-commit checks..."

# Run TypeScript check
npm run build

# Run linting (if available)
if [ -f "package.json" ] && grep -q "lint" package.json; then
    npm run lint
fi

echo "Pre-commit checks passed!"
EOF

chmod +x .git/hooks/pre-commit

# Create useful aliases
print_status "Creating useful aliases..."
cat >> ~/.bashrc << 'EOF'

# ZenithWell aliases
alias zz="cd $(pwd)"
alias zzdev="npm run dev"
alias zzbuild="npm run build"
alias zzstart="npm start"
alias zzlogs="sudo journalctl -u zenithwell -f"
alias zzrestart="sudo systemctl restart zenithwell"
alias zzstatus="sudo systemctl status zenithwell"
alias zzbackup="./backup.sh"
alias zzhealth="./health-check.sh"
EOF

# Reload bashrc
source ~/.bashrc

# Final setup instructions
print_success "🎉 ZenithWell setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env.local with your actual API keys and configuration"
echo "2. Run './setup-database.sh' to set up the database"
echo "3. Run 'npm run dev' to start the development server"
echo ""
echo "🔧 Available commands:"
echo "  zzdev     - Start development server"
echo "  zzbuild   - Build the application"
echo "  zzstart   - Start production server"
echo "  zzlogs    - View application logs"
echo "  zzrestart - Restart the service"
echo "  zzstatus  - Check service status"
echo "  zzbackup  - Create backup"
echo "  zzhealth  - Run health check"
echo ""
echo "📁 Created files:"
echo "  - .env.local (environment configuration)"
echo "  - setup-database.sh (database setup)"
echo "  - ecosystem.config.js (PM2 configuration)"
echo "  - nginx.conf.template (nginx configuration)"
echo "  - deploy.sh (deployment script)"
echo "  - backup.sh (backup script)"
echo "  - health-check.sh (health monitoring)"
echo ""
echo "🌐 The application will be available at: http://localhost:3000"
echo ""
print_warning "Don't forget to:"
echo "  - Configure your domain in nginx.conf.template"
echo "  - Set up SSL certificates for production"
echo "  - Configure firewall rules if needed"
echo "  - Set up monitoring and logging"
