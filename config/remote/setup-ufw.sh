#!/usr/bin/env bash
set -euo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

ssh_port="$(printf '%s\n' "${SSH_CONNECTION:-}" | awk '{ print $4 }')"

if [ -z "${ssh_port}" ]; then
  ssh_port="22"
fi

export DEBIAN_FRONTEND=noninteractive

as_root apt install ufw -y
as_root ufw allow "${ssh_port}/tcp"
as_root ufw allow 80/tcp
as_root ufw allow 443/tcp
as_root ufw --force enable
as_root ufw status verbose
