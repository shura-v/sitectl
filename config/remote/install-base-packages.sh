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
as_root apt install \
  sudo \
  git \
  ufw \
  nginx \
  certbot \
  python3-certbot-nginx \
  htop \
  curl \
  wget \
  unzip \
  ca-certificates \
  gnupg \
  lsb-release \
  nano \
  jq \
  rsync \
  zsh \
  unattended-upgrades \
  apt-listchanges \
  -y

as_root dpkg-reconfigure -f noninteractive unattended-upgrades

export RUNZSH=no
export CHSH=no
export KEEP_ZSHRC=yes
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
