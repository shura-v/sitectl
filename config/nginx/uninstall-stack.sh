#!/usr/bin/env bash
set -euo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

export DEBIAN_FRONTEND=noninteractive

as_root systemctl stop nginx || true
as_root systemctl disable nginx || true

as_root apt purge -y \
  nginx \
  nginx-common \
  nginx-core \
  certbot \
  python3-certbot-nginx || true

as_root apt autoremove -y --purge || true

as_root rm -rf \
  /etc/nginx \
  /var/log/nginx \
  /var/www/letsencrypt \
  /etc/letsencrypt \
  /var/lib/letsencrypt \
  /var/log/letsencrypt \
  /opt/certbot

as_root rm -f /etc/cron.d/sitectl-certbot-renew
