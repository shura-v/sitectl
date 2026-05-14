alias e="nano"
alias rcs="source ~/.zshrc"
alias rce="e ~/.zshrc && rcs"

setopt prompt_subst

export SERVER_FLAG=__SITECTL_SERVER_FLAG__

PROMPT='
%F{green}%~%f %F{196}[%D{%H:%M}]%f
${SERVER_FLAG:-🌍} $ '
