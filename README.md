# sitectl

A simple CLI for bootstrapping Linux servers, nginx site configs, and TLS
certificates.

It is opinionated, but customizable:
- today it is biased toward Debian-like servers because the bootstrap/install
  flow is written for `apt`, `nginx`, `certbot`, `ufw`, and related packages
- after install, you can edit the data files in `~/.config/sitectl/` however you
  want and adapt the tool to your own setup
- templates, remote scripts, and nginx configs are meant to be user-editable

This is a CLI-only utility for interactive local use. It is not intended for CI
or hermetic automation environments.

The workflow is interactive only:

- start `sitectl`
- choose an action from the menu
- follow the prompts

## Setup

```bash
npm install -g sitectl
```

On macOS, `Manage sites -> Copy conf files to server` expects a newer `rsync`
than the system one. Install it with Homebrew:

```bash
brew install rsync
```

## Menu

Main menu:

- `Manage servers`
- `Manage sites`
- `Open data dir`
- `Exit`

`Manage servers`:

- `Add server`
- `Edit server`
- `Delete server`
- `Install base packages`
- `Configure zsh`
- `Setup ufw`
- `Back`

`Manage sites`:

- `Add site`
- `Open nginx.conf`
- `Copy conf files to server`
- `Issue certificate`
- `Enable https`
- `Disable https`
- `Back`

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

## Manage Servers Workflow

Typical flow for a new VPS:

1. `Add server`
2. `sitectl ssh-copy-id`
3. `Install base packages`
4. `Configure zsh`
5. `Setup ufw`

What those actions do:

- `Add server`
  Creates a server record in `~/.config/sitectl/config.json`.
- `sitectl ssh-copy-id`
  Installs your SSH public key on the target server so the rest of the workflow
  can work over key-based SSH.
- `Install base packages`
  Runs the opinionated bootstrap script for Debian-like servers.
- `Configure zsh`
  Installs the custom shell config from `~/.config/sitectl/remote/`.
- `Setup ufw`
  Applies the default firewall rules for SSH, HTTP, and HTTPS.

## Manage Sites Workflow

Typical flow for a new site:

1. `Add site`
2. edit `nginx.conf`
3. `Copy conf files to server`
4. `Issue certificate`
5. `Enable https`

What those actions do:

- `Add site`
  Creates `~/.config/sitectl/nginx/sites/<domain>/` and seeds `nginx.conf`
  from the local template.
- `Open nginx.conf`
  Opens the local site config for editing.
- `Copy conf files to server`
  Uploads:
  - `<domain>.bootstrap.conf`
  - `<domain>.conf` if local `nginx.conf` exists
- `Issue certificate`
  Uses `certbot certonly --nginx -d <domain>`.
  This command is intended for the bootstrap flow when HTTPS is still disabled.
  After issuing a certificate, the site remains on the bootstrap HTTP config
  until you explicitly run `Enable https`.
- `Enable https`
  Switches `sites-enabled/<domain>.conf` to the main HTTPS config.
- `Disable https`
  Switches `sites-enabled/<domain>.conf` back to the bootstrap HTTP config.

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

Interactive actions are available through the menu opened by `sitectl`.

## Build

```bash
npm run build
```

Built CLI also starts without arguments:

```bash
node dist/index.js
```

Defaults are seeded from the packaged `config/` files during `prepare`, and the
runtime still recreates a missing file on demand if needed.
