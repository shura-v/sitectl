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
as_root apt upgrade -y

# Required for sitectl core workflows:
# - nginx site deployment
# - certificate issuance via certbot
# - firewall setup via ufw
# - remote script execution and file sync
as_root apt install \
  sudo \
  nginx \
  certbot \
  python3-certbot-nginx \
  curl \
  ca-certificates \
  rsync \
  git \
  -y

# Optional quality-of-life packages:
# - useful for manual server administration
# - not required for sitectl features to work
as_root apt install \
  htop \
  wget \
  unzip \
  gnupg \
  lsb-release \
  nano \
  jq \
  unattended-upgrades \
  apt-listchanges \
  -y

# Applies only when the optional unattended-upgrades package is installed.
if dpkg -s unattended-upgrades >/dev/null 2>&1; then
  as_root dpkg-reconfigure -f noninteractive unattended-upgrades
fi
