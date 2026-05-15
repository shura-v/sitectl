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

as_root systemctl stop docker.service docker.socket containerd.service 2>/dev/null || true

as_root apt purge -y \
  docker-ce \
  docker-ce-cli \
  docker-ce-rootless-extras \
  docker-buildx-plugin \
  docker-compose-plugin \
  docker.io \
  docker-compose \
  docker-compose-v2 \
  docker-doc \
  podman-docker \
  containerd \
  containerd.io \
  runc \
  || true

as_root apt autoremove -y || true

as_root rm -rf /var/lib/docker
as_root rm -rf /var/lib/containerd
as_root rm -rf /etc/docker
as_root rm -f /etc/apt/sources.list.d/docker.list
as_root rm -f /etc/apt/keyrings/docker.asc
as_root rm -f /etc/apt/keyrings/docker.gpg
