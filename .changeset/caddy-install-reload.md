---
"sitectl": patch
---

Preserve locally modified package configuration files when reinstalling Caddy. Copying a site now requires an existing Caddy installation and Caddyfile. The command validates the configuration before reloading an active service and leaves an inactive service stopped.
