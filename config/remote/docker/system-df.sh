#!/usr/bin/env bash
set -euo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed"
  exit 1
fi

if ! as_root docker info >/dev/null 2>&1; then
  echo "docker daemon is not available"
  exit 1
fi

mode="${SITECTL_DOCKER_SYSTEM_DF_MODE:-normal}"

if [ "${mode}" = "verbose" ]; then
  as_root docker system df -v
else
  as_root docker system df
fi
