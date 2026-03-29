# Fr33d0m OpenClaw

Fr33d0m OpenClaw is a branded operator shell around the real OpenClaw runtime. It keeps the public surface limited to one authenticated dashboard on `:18643`, then proxies the native OpenClaw UI and the browser terminal behind that shell.

## What this repo now includes

- `server.js` - Express backend shell with basic auth, proxy routes, and OpenClaw action APIs
- `frontend/` - React + Vite dashboard app served by the shell after build
- `install.sh` - Ubuntu installer that installs dependencies, builds the frontend, and wires systemd user services
- `bin/fr33d0m-openclaw` - branded OpenClaw wrapper
- `bin/fr33d0m-openclaw-shell` - branded shell launcher
- `bin/fr33d0m-openclaw-terminal-shell` - browser terminal shell wrapper
- `systemd/fr33d0m-openclaw-shell.service` - user service for the public dashboard
- `systemd/fr33d0m-openclaw-terminal.service` - user service for the local `ttyd` browser terminal

## Dashboard routes

The shell is intended to be the only public entrypoint on port `18643`.

| Route | Purpose |
| --- | --- |
| `/` | Home dashboard with status cards, runtime controls, autonomy profile, and OpenRouter + MiniMax setup |
| `/runtime` | Gateway lifecycle controls, doctor actions, and runtime logs |
| `/sessions` | Read-first session history from `openclaw sessions --json` |
| `/skills` | Read-first skills catalog and readiness checks |
| `/terminal/` | Embedded or standalone browser terminal proxied through the shell |
| `/openclaw/` | Embedded or standalone native OpenClaw UI proxied through the shell |

## Local development

Install the backend and frontend dependencies:

```bash
npm install
npm --prefix frontend install
```

Run the backend shell:

```bash
npm run dev
```

Run the Vite frontend separately during UI work:

```bash
FR33D0M_OPENCLAW_BACKEND=http://127.0.0.1:18643 npm run frontend:dev
```

Build the production dashboard bundle:

```bash
npm run frontend:build
```

Run the local verification bundle:

```bash
npm run verify
```

## Ubuntu install

```bash
git clone https://github.com/fr33d0m21/fr33dom-openclaw.git
cd fr33dom-openclaw
bash install.sh
source ~/.bashrc
```

The installer now:

- installs system dependencies including `ttyd`
- installs or upgrades Node.js
- installs `openclaw` globally
- installs local shell dependencies
- installs frontend dependencies and builds the React dashboard
- installs Fr33d0m wrapper commands
- configures the public shell and browser terminal user services
- opens port `18643` for the public shell

## First-run operator flow

Run the OpenClaw onboarding flow if the config does not exist yet:

```bash
fr33d0m-openclaw onboard --install-daemon
```

Useful runtime commands:

```bash
fr33d0m-openclaw gateway status
fr33d0m-openclaw doctor
fr33d0m-openclaw models status --json
fr33d0m-openclaw sessions --all-agents --json
```

## Public shell usage

After install, the shell listens on:

```text
http://<vm-ip>:18643/
```

The shell applies HTTP basic auth using the credentials written to:

```text
~/.openclaw/fr33d0m-shell.env
```

Only the shell should be public. The OpenClaw UI and terminal stay private and are exposed through `/openclaw/` and `/terminal/` on the same shell origin.

## Snapshot workflow

1. Install the repo on a clean Ubuntu Desktop VM.
2. Run `fr33d0m-openclaw onboard --install-daemon`.
3. Set the OpenRouter API key and default MiniMax model from the dashboard.
4. Verify gateway status, terminal proxy, and shell auth.
5. Create the DigitalOcean snapshot only after the shell is fully healthy.
