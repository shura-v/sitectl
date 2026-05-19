#!/usr/bin/env bash
set -euo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

repo_file="/etc/apt/sources.list.d/ookla_speedtest-cli.list"

export DEBIAN_FRONTEND=noninteractive

as_root apt-get install -y curl
curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | as_root bash

if [ -f "${repo_file}" ]; then
  as_root sed -i 's/\bnoble\b/jammy/g' "${repo_file}"
fi

as_root apt-get update
as_root apt-get install -y speedtest

speedtest --accept-license
