#!/bin/bash

# ZenithWell Deployment Script
# This script handles the deployment process for the Next.js application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="zenithwell"
APP_DIR="/home/kitsune/zenithwell"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
SITE_CONFIG="zenithwell"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root for system operations
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. Some operations may require sudo."
    fi
}

# Install PM2 globally if not installed
install_pm2() {
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2 globally..."
        npm install -g pm2
        log_success "PM2 installed successfully"
    else
        log_info "PM2 is already installed"
    fi
}

# Install nginx if not installed
install_nginx() {
    if ! command -v nginx &> /dev/null; then
        log_info "Installing nginx..."
        sudo apt update
        sudo apt install -y nginx
        sudo systemctl enable nginx
        log_success "Nginx installed successfully"
    else
        log_info "Nginx is already installed"
    fi
}

# Create logs directory
create_logs_dir() {
    log_info "Creating logs directory..."
    mkdir -p "$APP_DIR/logs"
    log_success "Logs directory created"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    cd "$APP_DIR"
    npm ci --production
    log_success "Dependencies installed"
}

# Build the application
build_app() {
    log_info "Building the application..."
    cd "$APP_DIR"
    npm run build
    log_success "Application built successfully"
}

# Setup nginx configuration
setup_nginx() {
    log_info "Setting up nginx configuration..."
    
    # Copy nginx config to sites-available
    sudo cp "$APP_DIR/nginx.conf" "$NGINX_SITES_AVAILABLE/$SITE_CONFIG"
    
    # Create symlink to sites-enabled
    if [ ! -L "$NGINX_SITES_ENABLED/$SITE_CONFIG" ]; then
        sudo ln -s "$NGINX_SITES_AVAILABLE/$SITE_CONFIG" "$NGINX_SITES_ENABLED/$SITE_CONFIG"
    fi
    
    # Test nginx configuration
    sudo nginx -t
    
    # Reload nginx
    sudo systemctl reload nginx
    
    log_success "Nginx configuration updated"
}

# Start/restart PM2 processes
start_pm2() {
    log_info "Starting PM2 processes..."
    cd "$APP_DIR"
    
    # Stop existing processes
    pm2 stop "$APP_NAME" 2>/dev/null || true
    pm2 delete "$APP_NAME" 2>/dev/null || true
    
    # Start new processes
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup
    
    log_success "PM2 processes started"
}

# Show status
show_status() {
    log_info "Application Status:"
    echo "===================="
    pm2 status
    echo ""
    log_info "Nginx Status:"
    sudo systemctl status nginx --no-pager
    echo ""
    log_info "Application Logs (last 20 lines):"
    pm2 logs "$APP_NAME" --lines 20
}

# Main deployment function
deploy() {
    log_info "Starting deployment of $APP_NAME..."
    
    check_root
    install_pm2
    install_nginx
    create_logs_dir
    install_dependencies
    build_app
    setup_nginx
    start_pm2
    
    log_success "Deployment completed successfully!"
    show_status
}

# Update function
update() {
    log_info "Updating $APP_NAME..."
    
    cd "$APP_DIR"
    
    # Pull latest changes (if using git)
    # git pull origin master
    
    install_dependencies
    build_app
    pm2 reload "$APP_NAME"
    
    log_success "Update completed successfully!"
    show_status
}

# Stop function
stop() {
    log_info "Stopping $APP_NAME..."
    pm2 stop "$APP_NAME"
    log_success "Application stopped"
}

# Start function
start() {
    log_info "Starting $APP_NAME..."
    pm2 start "$APP_NAME"
    log_success "Application started"
}

# Restart function
restart() {
    log_info "Restarting $APP_NAME..."
    pm2 restart "$APP_NAME"
    log_success "Application restarted"
}

# Show help
show_help() {
    echo "ZenithWell Deployment Script"
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy    - Full deployment (install, build, configure, start)"
    echo "  update    - Update application (rebuild and reload)"
    echo "  start     - Start the application"
    echo "  stop      - Stop the application"
    echo "  restart   - Restart the application"
    echo "  status    - Show application status"
    echo "  logs      - Show application logs"
    echo "  help      - Show this help message"
}

# Main script logic
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    update)
        update
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        show_status
        ;;
    logs)
        pm2 logs "$APP_NAME" --lines 50
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac