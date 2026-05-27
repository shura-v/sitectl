#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

installed_packages="$(
  for pkg in \
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
    runc; do
    if dpkg -s "$pkg" >/dev/null 2>&1; then
      printf '%s\n' "$pkg"
    fi
  done
)"

as_root systemctl stop docker.service docker.socket containerd.service 2>/dev/null || true

if [ -n "${installed_packages}" ]; then
  # Purge only installed packages so missing virtual names do not abort the uninstall.
  as_root apt-get purge -y ${installed_packages}
fi

as_root apt-get autoremove -y

as_root rm -rf /var/lib/docker
as_root rm -rf /var/lib/containerd
as_root rm -rf /etc/docker
as_root rm -f /etc/apt/sources.list.d/docker.list
as_root rm -f /etc/apt/keyrings/docker.asc
as_root rm -f /etc/apt/keyrings/docker.gpg
