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
as_root apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | as_root gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | as_root tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
as_root chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
as_root chmod o+r /etc/apt/sources.list.d/caddy-stable.list
as_root apt update
as_root apt install -y caddy
as_root systemctl enable caddy
as_root systemctl start caddy
