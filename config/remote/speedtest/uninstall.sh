#!/usr/bin/env bash
set -euo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

as_root apt-get remove -y speedtest || true
as_root rm -f /etc/apt/sources.list.d/ookla_speedtest-cli.list
as_root rm -f /etc/apt/sources.list.d/ookla_speedtest-cli.sources
as_root rm -f /etc/apt/trusted.gpg.d/ookla_speedtest-cli.gpg
as_root rm -f /usr/share/keyrings/ookla_speedtest-cli-archive-keyring.gpg
as_root apt-get update || true
