# sitectl

[![CI](https://github.com/shura-v/sitectl/actions/workflows/ci.yml/badge.svg)](https://github.com/shura-v/sitectl/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sitectl.svg)](https://www.npmjs.com/package/sitectl)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A simple CLI for bootstrapping Linux servers, nginx site configs, and TLS
certificates.

![Interactive sitectl workflow](docs/usage.gif)

## Install

```bash
npm install -g sitectl
sitectl init
```

Use `sitectl init --overwrite-bundled` to refresh bundled templates without replacing
user-managed data such as `config.json` or per-site nginx configs.

With `sitectl`, you can:

- manage your server list locally
- connect to servers over SSH and install your public key
- run built-in remote commands on servers
- add your own **custom remote commands and submenus**
- manage nginx site configs
- issue TLS certificates
- enable and disable HTTPS on a site
- remove site configs from a server

It is opinionated, but customizable:
- today it is biased toward Debian-like servers because the bootstrap/install
  flow is written for `apt`, `nginx`, `certbot`, `ufw`, and related packages
- after `sitectl init`, you can adapt the user-managed files in
  `~/.config/sitectl/` to your own setup
- the main nginx customization point is
  `~/.config/sitectl/nginx/sites/nginx-template.conf`
- one of the main customization points is `Remote commands`, which can be
  extended with your own scripts and submenus
- local development and test commands require Node.js 20 or newer

This is a CLI-only utility for interactive local use. It is not intended for CI
or hermetic automation environments.

The workflow is interactive only:

- run `sitectl init` once
- start `sitectl`
- choose an action from the menu
- follow the prompts

## What It Does

There are three main areas in `sitectl`:

- `Manage servers`
  Keeps a local registry of servers and gives you quick `ssh` / `ssh-copy-id`
  flows.
- `Remote commands`
  Runs built-in and custom server-side commands on a selected server.
- `Manage sites`
  Manages nginx site configs, certificate issuance, and HTTP/HTTPS switching.

## Support

`sitectl` is intended to run on Unix-like systems.

Supported remote server operating systems:

- Debian 12+
- Ubuntu 22.04+

Supported local environments:

- Linux
- macOS
- Windows via WSL

Native Windows is not supported at the moment.

Required local dependencies:

- Node.js 20+
- npm
- `ssh`
- `rsync`
- `ssh-copy-id`

Platform notes:

- On macOS, `Manage sites -> Copy conf files to server` expects a newer `rsync`
  than the system one. Install it with Homebrew:

```bash
brew install rsync
```

- On Linux, `Open data dir` and local config opening use `xdg-open`, which is
  typically provided by your desktop environment or `xdg-utils`.
- On Windows, use WSL and install the Linux dependencies inside WSL.

## Custom Remote Commands

One of the main features of `sitectl` is that `Remote commands` is not a hardcoded
menu. You can add your own server-side commands and submenus by dropping files
into `~/.config/sitectl/remote/`.

That means you can keep using the built-in commands, but also grow your own
library of deploy scripts, maintenance routines, bootstrap steps, and dangerous
ops with explicit confirmation prompts.

## Remote Command Discovery

Remote command menus are discovered from matching metadata files:

- `foo.sh` + `foo.json` becomes a command
- `folder/` + `folder.json` becomes a submenu
- files without matching `.json` metadata are ignored
- optional `order` sorts items inside the current menu; items without `order`
  are shown after ordered items and use alphabetical order as a tie-breaker

## Remote Command Metadata

Shape for remote metadata:

```ts
{
  name: string;
  order?: number;
  hidden?: boolean;
  confirmation?: string;
}
```

## Remote Command Example

Examples:

```text
remote/
  backups.sh
  backups.json
  docker/
    uninstall-docker.sh
    uninstall-docker.json
  docker.json
```

```json
{
  "name": "Uninstall Docker completely",
  "order": 20,
  "confirmation": "Are you sure you want to delete Docker containers, images, volumes, and package data?"
}
```

## Menu

- `Manage servers`
  - `Add server`
  - `Edit server`
  - `Delete server`
  - `SSH copy id`
  - `SSH`
- `Manage sites`
  - `Add site`
  - `Open nginx.conf`
  - `Copy conf files to server`
  - `Issue certificate`
  - `Enable https`
  - `Disable https`
  - `Remove site from server`
- `Remote commands`
  - `Install base packages`
  - `Docker`
    - `Install Docker`
    - `Uninstall Docker completely`
  - `Configure zsh`
  - `Setup ufw`
  - `...your custom commands...`
- `Open data dir`

The non-interactive commands are:

- `sitectl init`
- `sitectl init --overwrite-bundled`
- `sitectl ssh`
- `sitectl ssh <server-name>`
- `sitectl ssh <server-name> '<full remote command string>'`
- `sitectl ssh-copy-id`

For nginx site deployment, `sitectl` guarantees compatibility only for configs
that keep using its managed include files under `/etc/nginx/sitectl-includes/`
together with the user-editable
`~/.config/sitectl/nginx/sites/nginx-template.conf`. Other generated nginx
fragments are internal implementation details managed by `sitectl`.

Nginx site registry lives in:

- `~/.config/sitectl/nginx/sites/nginx-template.conf`
- `~/.config/sitectl/nginx/sites/<host>/nginx.conf`

## Manage Servers Workflow

Typical flow for a new VPS:

1. `Add server`
2. `SSH copy id`
3. `Remote commands -> Install base packages`
4. `Remote commands -> Docker -> Install Docker` if needed
5. `Remote commands -> Configure zsh`
6. `Remote commands -> Setup ufw`

What those actions do:

- `Add server`
  Creates a server record in `~/.config/sitectl/config.json`.
- `sitectl ssh-copy-id`
  Installs your SSH public key on the target server so the rest of the workflow
  can work over key-based SSH.
- `Install base packages`
  Runs the opinionated bootstrap script for supported Debian and Ubuntu
  servers.
- `Install docker`
  Installs Docker CE and the Docker Compose plugin from Docker's apt
  repository.
- `Uninstall docker completely`
  Completely removes Docker packages and permanently deletes Docker data, including
  containers, images, networks, and volumes.
- `Configure zsh`
  Installs `zsh` and `oh-my-zsh` if needed, then applies the custom shell
  config bundled inside `~/.config/sitectl/remote/configure-zsh.sh`.
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
  Creates `~/.config/sitectl/nginx/sites/<host>/` and seeds `nginx.conf`
  from `~/.config/sitectl/nginx/sites/nginx-template.conf`.
- `Open nginx.conf`
  Opens the local site config for editing.
- `Copy conf files to server`
  Uploads:
  - the internal HTTP-only site config managed by `sitectl`
  - `<host>.conf` if local `nginx.conf` exists
  - managed include files in `/etc/nginx/sitectl-includes/`
  The editable HTTPS/site config comes from your local site template and
  per-site config. Compatibility is guaranteed only for configs that keep using
  the managed `sitectl` include files.
- `Issue certificate`
  Uses `certbot certonly --nginx -d <host>` for domain hosts.
  For IP hosts, uses Certbot's IP certificate flow with `--webroot`,
  `--ip-address`, and the required `shortlived` profile.
  If the remote system Certbot is too old for IP issuance, `sitectl` can
  optionally install an isolated newer Certbot in `/opt/certbot` during the
  issuance flow.
  This command is intended for the initial HTTP-only flow before the main HTTPS
  config is enabled.
  After issuing a certificate, the site remains on the internal HTTP-only config
  until you explicitly run `Enable https`.
- `Enable https`
  Switches `sites-enabled/<host>.conf` to the main HTTPS config.
- `Disable https`
  Switches `sites-enabled/<host>.conf` back to the internal HTTP-only config.
- `Remove site from server`
  Deletes the remote nginx config, managed SSL include, and active symlink for
  the selected site. If the certificate lineage is clearly site-specific, it
  also removes the certbot certificate.

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
npm run ssh -- prod 'echo "hello world!"'
npm run ssh-copy-id
```

After global install:

```bash
sitectl ssh
sitectl ssh prod
sitectl ssh prod 'echo "hello world!"'
sitectl ssh-copy-id
```

Interactive actions are available through the menu opened by `sitectl`.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

The test suite covers host detection and nginx host rendering, including the
IPv6 `server_name [addr]` case used for site templates.

For IP certificate issuance, the remote server needs Certbot `5.4.0` or newer.
If the system package is older, `sitectl` can prompt to install an isolated
newer Certbot in `/opt/certbot` and configure renewal for it.

Built CLI also starts without arguments:

```bash
node dist/index.js
```
