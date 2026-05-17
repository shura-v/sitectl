#!/usr/bin/env bash
set -euo pipefail

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

myzshrc_path="${HOME}/.myzshrc"
zshrc_path="${HOME}/.zshrc"
source_line='[ -f "$HOME/.myzshrc" ] && source "$HOME/.myzshrc"'
server_flag="${SITECTL_SERVER_FLAG:-🌍}"
server_flag_escaped="${server_flag//\'/\'\\\'\'}"

if ! command -v curl >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1 || ! command -v zsh >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  as_root apt update
  as_root apt install -y curl git zsh
fi

if [ ! -d "${HOME}/.oh-my-zsh" ]; then
  export RUNZSH=no
  export CHSH=no
  export KEEP_ZSHRC=yes
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi

cat > "${myzshrc_path}" <<__SITECTL_MYZSHRC__
alias e="nano"
alias rcs="source ~/.zshrc"
alias rce="e ~/.myzshrc && rcs"

setopt prompt_subst

PROMPT='
%F{green}%~%f %F{196}[%D{%H:%M}]%f
${server_flag_escaped} %# '
__SITECTL_MYZSHRC__

touch "${zshrc_path}"

if ! grep -Fqx "${source_line}" "${zshrc_path}"; then
  {
    printf '\n'
    printf '%s\n' "${source_line}"
  } >> "${zshrc_path}"
fi
