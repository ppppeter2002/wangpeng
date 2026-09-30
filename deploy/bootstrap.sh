#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/srv/smart-tutor

sudo apt update
sudo apt install -y nginx curl build-essential

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo npm install -g pm2

mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "Upload project files into $APP_DIR before running npm install."
echo "Then configure environment variables and run:"
echo "  npm install"
echo "  npm run build"
echo "  pm2 start dist/server.js --name smart-tutor"
echo "  pm2 save"

