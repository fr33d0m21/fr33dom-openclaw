# Fr33d0m OpenClaw

An OpenClaw-based Fr33d0m VM project.

## Direction

This project is intended to use:

- OpenClaw Gateway as the backend/runtime
- a lighter Fr33d0m-branded admin shell as the operator UI
- Ubuntu Desktop on DigitalOcean as the base VM image
- snapshot-based deployment after the VM is configured and validated

## Current scaffold

This repo now includes:

- `install.sh` — Ubuntu installer scaffold for OpenClaw + `ttyd`
- `bin/fr33d0m-openclaw` — branded OpenClaw wrapper command
- `bin/fr33d0m-openclaw-terminal-shell` — browser-terminal shell with operator guidance
- `systemd/fr33d0m-openclaw-terminal.service` — reference `ttyd` service for a browser shell

## Goals

- install and configure OpenClaw cleanly on Ubuntu
- provide a Fr33d0m-style dashboard for setup and operations
- expose browser terminal access safely
- support a repeatable image/snapshot workflow

## Install scaffold (Ubuntu)

```bash
git clone https://github.com/fr33d0m21/fr33dom-openclaw.git
cd fr33dom-openclaw
bash install.sh
source ~/.bashrc
```

The scaffold installer currently:

- installs system prerequisites
- installs Node.js if needed
- installs `openclaw` globally with npm
- installs Fr33d0m-branded wrapper commands
- installs a browser-terminal user service using `ttyd`

## Next steps after install

Run the official onboarding flow:

```bash
fr33d0m-openclaw onboard --install-daemon
```

Useful commands:

```bash
fr33d0m-openclaw gateway --port 18789 --verbose
fr33d0m-openclaw doctor
fr33d0m-openclaw config get
```

Expected OpenClaw UI once the gateway is up:

```text
http://127.0.0.1:18789/
```

Browser terminal from the scaffold service:

```text
http://127.0.0.1:17681/terminal/
```

## Planned phases

1. Script OpenClaw install and daemon setup on Ubuntu.
2. Decide how much of the built-in OpenClaw Control UI to reuse.
3. Build a Fr33d0m admin shell around the real OpenClaw runtime.
4. Add VM-friendly operational tooling and documentation.
5. Create a snapshot-ready DigitalOcean workflow.

## Status

Initial OpenClaw VM scaffold is now in place and ready for the next implementation step.
