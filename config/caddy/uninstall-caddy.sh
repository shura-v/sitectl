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

as_root systemctl stop caddy || true
as_root systemctl disable caddy || true

if dpkg -s caddy >/dev/null 2>&1; then
  as_root apt purge -y caddy
fi

as_root apt autoremove -y --purge

as_root rm -rf \
  /etc/caddy \
  /var/lib/caddy/.local/share/caddy \
  /var/lib/caddy/.config/caddy \
  /var/log/caddy

as_root rm -f \
  /etc/apt/sources.list.d/caddy-stable.list \
  /usr/share/keyrings/caddy-stable-archive-keyring.gpg
