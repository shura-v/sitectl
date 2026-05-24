---
"sitectl": patch
---

Add remote command metadata support for free-form text prompts and command-level
`env` values.

Treat prompt `options` as an explicit select mode, while prompts without
`options` now collect free-form text input.

Prefer command metadata `env` for reusable defaults, while still allowing
per-invocation overrides through `SITECTL_ENV_*` shell variables.
