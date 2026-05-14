#!/usr/bin/env bash
set -euo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

ssh_port="__SITECTL_SSH_PORT__"

as_root apt install ufw -y
as_root ufw allow "${ssh_port}/tcp"
as_root ufw allow 80/tcp
as_root ufw allow 443/tcp
as_root ufw --force enable
as_root ufw status verbose
