# sitectl

Minimal TypeScript CLI scaffold for site operations.

This is a CLI-only utility for interactive local use. It is not intended for CI
or hermetic automation environments.

## Setup

```bash
npm install
```

On macOS, `Manage sites -> Copy conf files to server` expects a newer `rsync`
than the system one. Install it with Homebrew:

```bash
brew install rsync
```

## Run

```bash
npm run dev
```

SSH command:

```bash
npm run ssh
npm run ssh -- prod
npm run ssh-copy-id
```

After global install:

```bash
sitectl ssh
sitectl ssh prod
sitectl ssh-copy-id
```

Interactive server actions also include:

- `Open data dir`
- `Manage servers`
- `Manage sites`

## Build

```bash
npm run build
```

Built CLI also starts without arguments:

```bash
node dist/index.js
```

## Config

Server records are stored locally in:

```text
~/.config/sitectl/config.json
```

Current server shape:

```json
{
  "servers": {
    "prod": {
      "address": "203.0.113.10",
      "flag": "🌍",
      "port": 22,
      "user": "root"
    }
  }
}
```

The workflow is interactive only:

- start `sitectl`
- choose an action from the menu
- follow the prompts

Main menu currently includes:

- `Manage servers`
- `Manage sites`
- `Open data dir`

The non-interactive commands are:

- `sitectl ssh`
- `sitectl ssh <server-name>`
- `sitectl ssh-copy-id`

Remote automation assets live in:

- `~/.config/sitectl/nginx/bootstrap.conf`
- `~/.config/sitectl/remote/install-base-packages.sh`
- `~/.config/sitectl/remote/configure-zsh.sh`
- `~/.config/sitectl/remote/myzshrc.zsh`
- `~/.config/sitectl/remote/setup-ufw.sh`

Nginx site registry lives in:

- `~/.config/sitectl/nginx/sites/<domain>/nginx.conf`

`Manage sites` currently does one thing:

- pick a local site folder from `~/.config/sitectl/nginx/sites`
- generate `<domain>.bootstrap.conf` from `~/.config/sitectl/nginx/bootstrap.conf`
- read the HTTPS config from `<domain>/nginx.conf`
- sync both files to `/etc/nginx/sites-available/` on the selected server

Defaults are seeded from the packaged `config/` files during `prepare`, and the
runtime still recreates a missing file on demand if needed.
