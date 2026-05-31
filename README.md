# sitectl

[![CI](https://github.com/shura-v/sitectl/actions/workflows/ci.yml/badge.svg)](https://github.com/shura-v/sitectl/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sitectl.svg)](https://www.npmjs.com/package/sitectl)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/shura-v/sitectl/main/LICENSE)

A simple CLI for bootstrapping Linux servers, managing Caddy and nginx configs, and TLS
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
user-managed data such as `config.json` or per-site Caddy/nginx configs.

## Features

With `sitectl`, you can:

- `Manage servers`
  Keeps a local registry of servers, gives you quick `ssh` / `ssh-copy-id` flows,
  and lets you sync local files to a selected server over `rsync`.
- `Manage caddy`
  Manages domain-first Caddy site configs and remote Caddy deployment.
- `Manage nginx`
  Manages nginx site configs, certificate issuance, and HTTP/HTTPS switching.
- `Remote commands`
  Runs built-in and custom server-side commands on a selected server.

It is opinionated, but customizable:
- today it is biased toward Debian-like servers because the bootstrap/install
  flows are written for `apt`, `ufw`, and related packages, with dedicated
  `Caddy` and `nginx` management flows for web-server setup
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

- On macOS, `Manage caddy -> Copy conf files to server` and
  `Manage nginx -> Copy conf files to server` expect a newer `rsync`
  than the system one. Install it with Homebrew:

```bash
brew install rsync
```

- On Linux, `Open data dir` and local config opening use `xdg-open`, which is
  typically provided by your desktop environment or `xdg-utils`.
- On Windows, use WSL and install the Linux dependencies inside WSL.

## Custom Remote Commands

One of the main customization points in `sitectl` is `Remote commands`. You can
add your own server-side commands and submenus by dropping files into
`~/.config/sitectl/remote/`.

That means you can keep using the built-in commands, but also grow your own
library of deploy scripts, maintenance routines, bootstrap steps, and dangerous
ops with explicit confirmation prompts.

You can run those commands either from the interactive menu or directly from the
CLI with:

```bash
sitectl run docker/install-docker my-server
```

The first argument is the command path inside `~/.config/sitectl/remote/`, using
folder names plus the command basename without the file extension. The second
argument is the configured server name.

For discovery rules, metadata fields, uploads, prompts, and examples, see
[docs/remote-commands.md](docs/remote-commands.md).

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
