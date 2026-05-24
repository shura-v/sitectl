# sitectl

## 0.3.2

### Patch Changes

- 9f69f4b: Add remote command metadata support for free-form text prompts and command-level
  `env` values.

  Treat prompt `options` as an explicit select mode, while prompts without
  `options` now collect free-form text input.

  Prefer command metadata `env` for reusable defaults, while still allowing
  per-invocation overrides through `SITECTL_ENV_*` shell variables.

## 0.3.1

### Patch Changes

- 465e1be: Restrict custom remote command prompt and forwarded environment variables to the
  `SITECTL_ENV_*` namespace, while keeping `SITECTL_SERVER_*` reserved for
  built-in server values managed by `sitectl`.

## 0.3.0

### Minor Changes

- ee87ada: Add bundled Docker remote commands for container stats and disk usage.

  Remote command metadata now supports command-level `prompts`, including
  interactive menu selection and local env overrides for `sitectl run`.

## 0.2.4

### Patch Changes

- fd0f594: Add `uploads` support for custom `Remote commands`, so a command can upload local files or directories before running its server-side script.

  Add a non-interactive `sitectl run <command> <server_name>` command for running custom remote commands by their file path inside `remote/` against a chosen server.

  Improve rsync path handling for uploads and document the new upload and server sync workflows in the README.

  Bundle `Speedtest` remote commands for installing, running, and uninstalling the Ookla CLI.

## 0.2.3

### Patch Changes

- 664c272: Add a `Sync files to server` command for uploading one local file or directory to a configured server with rsync.

  Raise the minimum supported Node.js version to 22.17.

## 0.2.2

### Patch Changes

- 64b357e: Fix Configure zsh to switch the default shell to zsh, preserve access to admin
  commands in PATH, and generate the prompt config safely.

  Update Issue certificate to save the Certbot email in config.json and run
  Certbot non-interactively with the saved email.

## 0.2.1

### Patch Changes

- 3c9ddc6: Adjust the npm publish workflow to use `NODE_AUTH_TOKEN` with Changesets.

## 0.2.0

### Minor Changes

- 9b564f6: Added data-driven `Remote commands` with support for custom commands and submenus from `~/.config/sitectl/remote`.

  Added remote command metadata via matching `.json` files with support for `name`, `order`, `hidden`, and `confirmation`.

  Added explicit `sitectl init` and `sitectl init --overwrite-bundled` flow for bundled files.

  Changed Docker command confirmations to use local CLI prompts.

  Improved docs and CI/publish workflows.

  Existing users may need to run `sitectl init` after upgrading to add newly bundled files.

  Run `sitectl init --overwrite-bundled` if you want to restore or refresh bundled scripts/templates to the current shipped versions.
