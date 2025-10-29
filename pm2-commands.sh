#!/bin/bash

# PM2 Management Commands for ZenithWell
# Quick reference for common PM2 operations

APP_NAME="zenithwell"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}ZenithWell PM2 Management${NC}"
echo "=========================="

case "${1:-help}" in
    "start")
        echo -e "${GREEN}Starting $APP_NAME...${NC}"
        pm2 start ecosystem.config.js --env production
        pm2 save
        ;;
    "stop")
        echo -e "${YELLOW}Stopping $APP_NAME...${NC}"
        pm2 stop $APP_NAME
        ;;
    "restart")
        echo -e "${YELLOW}Restarting $APP_NAME...${NC}"
        pm2 restart $APP_NAME
        ;;
    "reload")
        echo -e "${YELLOW}Reloading $APP_NAME (zero-downtime)...${NC}"
        pm2 reload $APP_NAME
        ;;
    "delete")
        echo -e "${YELLOW}Deleting $APP_NAME...${NC}"
        pm2 delete $APP_NAME
        ;;
    "status")
        echo -e "${BLUE}PM2 Status:${NC}"
        pm2 status
        ;;
    "logs")
        echo -e "${BLUE}Showing logs for $APP_NAME:${NC}"
        pm2 logs $APP_NAME --lines 50
        ;;
    "monit")
        echo -e "${BLUE}Opening PM2 monitoring dashboard...${NC}"
        pm2 monit
        ;;
    "save")
        echo -e "${GREEN}Saving PM2 configuration...${NC}"
        pm2 save
        ;;
    "resurrect")
        echo -e "${GREEN}Resurrecting saved PM2 processes...${NC}"
        pm2 resurrect
        ;;
    "startup")
        echo -e "${GREEN}Setting up PM2 startup script...${NC}"
        pm2 startup
        ;;
    "unstartup")
        echo -e "${YELLOW}Removing PM2 startup script...${NC}"
        pm2 unstartup
        ;;
    "help"|*)
        echo "Available commands:"
        echo "  start     - Start the application"
        echo "  stop      - Stop the application"
        echo "  restart   - Restart the application"
        echo "  reload    - Reload the application (zero-downtime)"
        echo "  delete    - Delete the application from PM2"
        echo "  status    - Show PM2 status"
        echo "  logs      - Show application logs"
        echo "  monit     - Open PM2 monitoring dashboard"
        echo "  save      - Save current PM2 configuration"
        echo "  resurrect - Restore saved PM2 processes"
        echo "  startup   - Setup PM2 to start on boot"
        echo "  unstartup - Remove PM2 startup configuration"
        echo ""
        echo "Usage: $0 [command]"
        ;;
esac