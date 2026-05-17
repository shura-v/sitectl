---
"sitectl": minor
---

Added data-driven `Remote commands` with support for custom commands and submenus from `~/.config/sitectl/remote`.

Added remote command metadata via matching `.json` files with support for `name`, `order`, `hidden`, and `confirmation`.

Added explicit `sitectl init` and `sitectl init --overwrite-bundled` flow for bundled files.

Changed Docker command confirmations to use local CLI prompts.

Improved docs and CI/publish workflows.

Existing users may need to run `sitectl init` after upgrading to add newly bundled files.

Run `sitectl init --overwrite-bundled` if you want to restore or refresh bundled scripts/templates to the current shipped versions.
