# sitectl

Minimal TypeScript CLI scaffold for site operations.

## Setup

```bash
npm install
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

## Build

```bash
npm run build
```

Built CLI also starts without arguments:

```bash
node dist/index.js
```

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
      "port": 22,
      "user": "root"
    }
  }
}
```

The workflow is interactive only:

- start `sitectl`
- choose an action from the menu
- follow the prompts

The non-interactive commands are:

- `sitectl ssh`
- `sitectl ssh <server-name>`
- `sitectl ssh-copy-id`
