#!/bin/bash

# Update script for ZenithWell
# Pulls from git, builds, and restarts PM2

echo "🚀 Starting ZenithWell update process..."

# Change to project directory
cd /home/kitsune/zenithwell

# Pull latest changes from git
echo "📥 Pulling latest changes from git..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!"
    exit 1
fi

echo "✅ Git pull successful"

# Install/update dependencies
echo "📦 Installing/updating dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo "✅ Dependencies updated"

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart zenithwell

if [ $? -ne 0 ]; then
    echo "❌ PM2 restart failed!"
    exit 1
fi

echo "✅ PM2 restarted successfully"

# Show PM2 status
echo "📊 Current PM2 status:"
pm2 status

echo "🎉 Update completed successfully!"
