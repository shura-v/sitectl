# sitectl

[![CI](https://github.com/shura-v/sitectl/actions/workflows/ci.yml/badge.svg)](https://github.com/shura-v/sitectl/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sitectl.svg)](https://www.npmjs.com/package/sitectl)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/shura-v/sitectl/main/LICENSE)

A simple CLI for bootstrapping Linux servers, nginx site configs, and TLS
certificates.

It is primarily intended for admin-style management of personal or small-scale
VPS/VDS hosts.

![Interactive sitectl workflow](https://raw.githubusercontent.com/shura-v/sitectl/main/docs/usage.gif)

## Install

```bash
npm install -g sitectl
sitectl init
```

Use `sitectl init --overwrite-bundled` to refresh bundled templates without replacing
user-managed data such as `config.json` or per-site nginx configs.

## What It Does

There are three main areas in `sitectl`:

- `Manage servers`
  Keeps a local registry of servers, gives you quick `ssh` / `ssh-copy-id` flows,
  and lets you sync local files to a selected server over `rsync`.
- `Manage sites`
  Manages nginx site configs, certificate issuance, and HTTP/HTTPS switching.
- `Remote commands`
  Runs built-in and custom server-side commands on a selected server.

With `sitectl`, you can:

- manage your server list locally
- connect to servers over SSH, install your public key, and sync local files
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
- local development and test commands require Node.js 22.17 or newer

This is a CLI-only utility for interactive local use. It is not intended for CI
or hermetic automation environments.

The workflow is interactive only:

- run `sitectl init` once
- start `sitectl`
- choose an action from the menu
- follow the prompts

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

- Node.js 22.17+
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

Built-in bundled remote commands include base package setup, Docker helpers,
firewall setup, shell setup, and a `Speedtest` submenu for installing, running,
and removing the Ookla CLI.

You can run those commands either from the interactive menu or directly from the
CLI with:

```bash
sitectl run docker/install-docker my-server
```

The first argument is the command path inside `~/.config/sitectl/remote/`, using
folder names plus the command basename without the file extension. The second
argument is the configured server name.

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
  env?: Record<string, string>;
  prompts?: Array<{
    env: string;
    message: string;
    options?: Array<{
      label: string;
      value: string;
      hint?: string;
    }>;
  }>;
  uploads?: Array<{
    from: string;
    to: string;
  }>;
}
```

`prompts`, `confirmation`, and `uploads` apply only to runnable command files,
not submenu metadata for directories.

When `env` is present, `sitectl` exports those variables into the remote script
automatically:

- use `env` for stable command-specific defaults that should live with the command metadata
- `env` keys must use valid shell variable names
- `SITECTL_SERVER_*` names are reserved and cannot be overridden
- `env` values are plain strings and are exported before the script starts

This is the preferred way to provide fixed parameters for a remote command,
instead of relying on command-line environment prefixes.

When `uploads` is present, `sitectl` uploads those local paths before it starts the
remote script:

- `from` is a local file or directory path on the machine running `sitectl`
- `from` also supports a glob, but it must resolve to exactly one path
- `to` is the final destination path on the remote server
- parent directories for `to` are created automatically before `rsync` runs
- the remote script starts only after every upload succeeds

This is useful when a remote command needs a local file first, for example to
restore backups, replace a database, upload a release artifact, send config
files, or stage migration data before the server-side script runs.

When `prompts` is present, `sitectl` asks the user for values before the remote
script starts, then exports those values as environment variables for the
script:

- `env` is the environment variable name that will be exported to the remote script
- `env` must start with `SITECTL_ENV_` and use only uppercase letters, numbers, and underscores
- `message` is the prompt shown locally before SSH starts
- `options` is optional; when present, `sitectl` shows a select with allowed values
- without `options`, `sitectl` shows a free-form text prompt
- `label` is what the user sees in the select menu
- `value` is what gets exported into the remote environment
- `hint` is optional helper text shown beside a select option

This is useful when one remote command should support a small set of explicit
modes without duplicating nearly identical scripts, or when the script needs a
small free-form value like a tag, branch, or identifier.

For direct CLI runs with `sitectl run <command> <server_name>`, prefer defining
default values in the command's JSON `env` block. When a prompt still needs a
non-interactive value, `sitectl run` resolves it in this order:

1. matching keys from the command metadata `env`
2. matching local `SITECTL_ENV_*` variables from the shell environment

Example with JSON-managed defaults:

```json
{
  "name": "Show Docker disk usage",
  "env": {
    "SITECTL_ENV_DOCKER_SYSTEM_DF_MODE": "verbose"
  }
}
```

Command-line environment variables are still supported as an override/fallback:

```bash
SITECTL_ENV_DOCKER_SYSTEM_DF_MODE=verbose sitectl run docker/system-df my-server
```

Additionally, `sitectl run ...` forwards all local environment variables whose
names match `SITECTL_ENV_[A-Z0-9_]+` into the remote script. The
`SITECTL_SERVER_*` namespace is reserved for built-in server values that
`sitectl` manages itself.

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

Upload example:

```json
{
  "name": "Replace 3x-ui DB",
  "confirmation": "This will overwrite the remote 3x-ui database. Continue?",
  "uploads": [
    {
      "from": "~/Backups/x-ui.db",
      "to": "/tmp/sitectl/3x-ui-replace-db/x-ui.db"
    }
  ]
}
```

That command can then use a remote shell script that moves the uploaded file into
place, restarts services, or performs any other server-side steps it needs.

## Menu

- `Manage servers`
  - `Add server`
  - `Edit server`
  - `Delete server`
  - `Sync files to server`
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
  - `Speedtest`
    - `Install speedtest`
    - `Run speedtest`
    - `Uninstall speedtest`
  - `Configure zsh`
  - `Setup ufw`
  - `...your custom commands...`
- `Open data dir`

The non-interactive commands are:

- `sitectl init`
- `sitectl init --overwrite-bundled`
- `sitectl run <command> <server_name>`
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
- `Sync files to server`
  Uploads a local file or directory to a chosen remote destination over `rsync`.
  Useful for one-off copies into `/tmp`, home-directory paths like `~/uploads/`,
  or other server-side locations before you run follow-up commands.
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
  Installs `zsh` and `oh-my-zsh` if needed, switches the user's default shell
  to `zsh`, then applies the custom shell config bundled inside
  `~/.config/sitectl/remote/configure-zsh.sh`.
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
