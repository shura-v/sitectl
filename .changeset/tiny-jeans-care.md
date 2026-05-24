---
"sitectl": patch
---

Restrict custom remote command prompt and forwarded environment variables to the
`SITECTL_ENV_*` namespace, while keeping `SITECTL_SERVER_*` reserved for
built-in server values managed by `sitectl`.
