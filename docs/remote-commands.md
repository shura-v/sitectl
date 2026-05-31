# Remote Commands

`Remote commands` is one of the main customization points in `sitectl`. You can
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

## Discovery

Remote command menus are discovered from matching metadata files:

- `foo.sh` + `foo.json` becomes a command
- `folder/` + `folder.json` becomes a submenu
- files without matching `.json` metadata are ignored
- optional `order` sorts items inside the current menu; items without `order`
  are shown after ordered items and use alphabetical order as a tie-breaker

## Metadata

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

## Example

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
