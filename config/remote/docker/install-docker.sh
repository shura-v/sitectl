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

# Uninstall all conflicting packages.
conflicting_packages="$(dpkg --get-selections docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc | cut -f1)"
if [ -n "${conflicting_packages}" ]; then
  as_root apt remove -y ${conflicting_packages}
fi

# Ensure curl is available even if base packages were not installed first.
if ! command -v curl >/dev/null 2>&1; then
  as_root apt update
  as_root apt install -y curl
fi

# Set up Docker's apt repository.
tmp_script="$(mktemp)"
trap 'rm -f "${tmp_script}"' EXIT
curl -fsSL https://get.docker.com -o "${tmp_script}"
as_root sh "${tmp_script}" --setup-repo

# Install the latest version.
as_root apt update
as_root apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

as_root systemctl status docker || as_root systemctl start docker
