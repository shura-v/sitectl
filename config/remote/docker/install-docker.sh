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

conflicting_packages="$(
  for pkg in docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc; do
    if dpkg -s "$pkg" >/dev/null 2>&1; then
      printf '%s\n' "$pkg"
    fi
  done
)"

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
