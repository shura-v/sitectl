#!/usr/bin/env bash
set -euo pipefail

myzshrc_path="${HOME}/.myzshrc"
zshrc_path="${HOME}/.zshrc"
source_line='[ -f "$HOME/.myzshrc" ] && source "$HOME/.myzshrc"'

cat > "${myzshrc_path}" <<'__SITECTL_MYZSHRC__'
__SITECTL_MYZSHRC_CONTENT__
__SITECTL_MYZSHRC__

touch "${zshrc_path}"

if ! grep -Fqx "${source_line}" "${zshrc_path}"; then
  {
    printf '\n'
    printf '%s\n' "${source_line}"
  } >> "${zshrc_path}"
fi
