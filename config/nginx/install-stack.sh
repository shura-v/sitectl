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

as_root apt update
as_root apt install \
  nginx \
  certbot \
  python3-certbot-nginx \
  -y

as_root systemctl enable nginx
as_root systemctl start nginx
