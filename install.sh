#!/bin/bash

echo "Updating Termux packages..."
pkg update && pkg upgrade -y

echo "Installing required packages: nodejs, git, sqlite..."
pkg install nodejs git sqlite -y

echo "Cloning repository if not already cloned..."
if [ ! -d "web-v2" ]; then
  git clone https://github.com/eureka-zzz/web-v2.git
fi

cd web-v2

echo "Installing Node.js dependencies (including better-sqlite3)..."
npm install

echo "Setting execute permissions..."
chmod +x install.sh
chmod +x server/index.js

echo "Installation complete. You can now run the server with 'npm start' or 'node server/index.js'."
