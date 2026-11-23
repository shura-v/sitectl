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
as_root apt -o Dpkg::Options::=--force-confold install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
tmp_dir=$(mktemp -d)
trap 'rm -rf -- "$tmp_dir"' EXIT
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --dearmor > "$tmp_dir/keyring.gpg"
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o "$tmp_dir/caddy.list"
as_root install -m 0644 "$tmp_dir/keyring.gpg" /usr/share/keyrings/caddy-stable-archive-keyring.gpg
as_root install -m 0644 "$tmp_dir/caddy.list" /etc/apt/sources.list.d/caddy-stable.list
as_root apt update
as_root apt -o Dpkg::Options::=--force-confold install -y caddy
as_root systemctl enable caddy
as_root systemctl start caddy
