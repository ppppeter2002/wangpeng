#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-smart-tutor}"
APP_DIR="${APP_DIR:-/srv/smart-tutor}"
APP_USER="${APP_USER:-$USER}"

sudo apt update
sudo apt install -y nginx curl build-essential ca-certificates gnupg

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo npm install -g pm2

sudo mkdir -p "$APP_DIR"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"

cat <<EOF
[smart-tutor bootstrap ready]
1. Upload project files into: $APP_DIR
2. Copy deploy/smart-tutor.env.example to /etc/$APP_NAME.env and fill real values
3. In $APP_DIR run:
   npm install
   npm run build
4. Start app with PM2:
   cp deploy/ecosystem.config.cjs $APP_DIR/ecosystem.config.cjs
   pm2 start $APP_DIR/ecosystem.config.cjs --env production
   pm2 save
5. Enable PM2 autostart (official startup command):
   pm2 startup
6. Install nginx site:
   sudo cp deploy/nginx.smart-tutor.conf /etc/nginx/sites-available/$APP_NAME.conf
   sudo ln -sf /etc/nginx/sites-available/$APP_NAME.conf /etc/nginx/sites-enabled/$APP_NAME.conf
   sudo nginx -t && sudo systemctl reload nginx
7. After ICP + DNS are ready, issue HTTPS certificate with Certbot for your API domain.
8. Run deploy/post-deploy-check.sh for smoke checks.

Current variables:
  APP_NAME=$APP_NAME
  APP_DIR=$APP_DIR
  APP_USER=$APP_USER
EOF
