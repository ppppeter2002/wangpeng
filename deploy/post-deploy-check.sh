#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-smart-tutor}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/${APP_NAME}.conf}"

echo "[1/4] nginx syntax"
sudo nginx -t

echo "[2/4] pm2 process list"
pm2 list

echo "[3/4] local health"
curl -fsSL "$HEALTH_URL"
echo

echo "[4/4] config pointers"
echo "nginx site: $NGINX_SITE"
echo "remember to verify public HTTPS domain and WeChat legal domain after ICP completes"
