alias e="nano"
alias rcs="source ~/.zshrc"
alias rce="e ~/.zshrc && rcs"
alias purge="sudo apt autoremove --purge && sudo apt autoclean && sudo journalctl --vacuum-time=7d"
alias dstats="docker stats --no-stream"
alias xe="e /usr/local/x-ui/bin/config.json"

setopt prompt_subst

export SERVER_FLAG=__SITECTL_SERVER_FLAG__

PROMPT='
%F{green}%~%f %F{196}[%D{%H:%M}]%f
${SERVER_FLAG:-🌍} $ '
