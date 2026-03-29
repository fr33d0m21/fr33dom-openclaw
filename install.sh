#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_BIN="$HOME/.local/bin"
CURRENT_USER="$(whoami)"
SHELL_ENV_FILE="$OPENCLAW_HOME/fr33d0m-shell.env"

info()  { printf "${CYAN}→${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${RESET} %s\n" "$1"; }
fail()  { printf "${RED}✗${RESET} %s\n" "$1"; }

echo -e "${BOLD}${GREEN}"
cat << 'BANNER'

 ███████╗██████╗ ██████╗ ██████╗ ██████╗  ██████╗ ███╗   ███╗
 ██╔════╝██╔══██╗╚════██╗╚════██╗██╔══██╗██╔═══██╗████╗ ████║
 █████╗  ██████╔╝ █████╔╝ █████╔╝██║  ██║██║   ██║██╔████╔██║
 ██╔══╝  ██╔══██╗ ╚═══██╗ ╚═══██╗██║  ██║██║   ██║██║╚██╔╝██║
 ██║     ██║  ██║██████╔╝██████╔╝██████╔╝╚██████╔╝██║ ╚═╝ ██║
 ╚═╝     ╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝     ╚═╝

BANNER
echo -e "${RESET}"
echo -e "${BOLD}  OpenClaw Ubuntu Scaffold Installer${RESET}"
echo ""

install_system_deps() {
  local missing=()
  command -v git &>/dev/null || missing+=(git)
  command -v curl &>/dev/null || missing+=(curl)
  command -v rg &>/dev/null || missing+=(ripgrep)
  command -v ffmpeg &>/dev/null || missing+=(ffmpeg)
  command -v ttyd &>/dev/null || missing+=(ttyd)

  if [ ${#missing[@]} -gt 0 ]; then
    info "Installing system packages: ${missing[*]}"
    sudo apt-get update -qq
    sudo apt-get install -y -qq "${missing[@]}"
  fi
  ok "System dependencies ready"
}

ensure_node() {
  local install_node="false"
  if ! command -v node &>/dev/null; then
    install_node="true"
  else
    local major
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "${major:-0}" -lt 22 ]; then
      install_node="true"
    fi
  fi

  if [ "$install_node" = "true" ]; then
    info "Installing Node.js 24.x..."
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
  fi

  ok "Node.js ready ($(node -v))"
}

install_openclaw() {
  if command -v openclaw &>/dev/null; then
    ok "OpenClaw already installed ($(openclaw --version 2>/dev/null || echo present))"
  else
    info "Installing OpenClaw globally with npm..."
    sudo npm install -g openclaw@latest
    ok "OpenClaw installed"
  fi
}

ensure_shell_auth_env() {
  mkdir -p "$OPENCLAW_HOME"

  local shell_user="fr33d0m"
  local shell_pass=""

  if [ -f "$SHELL_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$SHELL_ENV_FILE"
    shell_user="${FR33D0M_OPENCLAW_SHELL_USER:-$shell_user}"
    shell_pass="${FR33D0M_OPENCLAW_SHELL_PASS:-}"
  fi

  if [ -z "$shell_pass" ]; then
    shell_pass="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(18))
PY
)"
  fi

  cat > "$SHELL_ENV_FILE" <<EOF
FR33D0M_OPENCLAW_SHELL_USER=$shell_user
FR33D0M_OPENCLAW_SHELL_PASS=$shell_pass
EOF
  chmod 600 "$SHELL_ENV_FILE"

  export FR33D0M_OPENCLAW_SHELL_USER="$shell_user"
  export FR33D0M_OPENCLAW_SHELL_PASS="$shell_pass"
  ok "Shell auth credentials prepared"
}

install_shell_dependencies() {
  if [ -f "$SCRIPT_DIR/package.json" ]; then
    info "Installing local Node dependencies for the Fr33d0m OpenClaw shell..."
    (cd "$SCRIPT_DIR" && npm install --silent)
    ok "Local shell dependencies installed"
  fi
}

install_wrappers() {
  mkdir -p "$LOCAL_BIN"
  cp "$SCRIPT_DIR/bin/fr33d0m-openclaw" "$LOCAL_BIN/fr33d0m-openclaw"
  cp "$SCRIPT_DIR/bin/fr33d0m-openclaw-shell" "$LOCAL_BIN/fr33d0m-openclaw-shell"
  cp "$SCRIPT_DIR/bin/fr33d0m-openclaw-terminal-shell" "$LOCAL_BIN/fr33d0m-openclaw-terminal-shell"
  chmod +x "$LOCAL_BIN/fr33d0m-openclaw" "$LOCAL_BIN/fr33d0m-openclaw-shell" "$LOCAL_BIN/fr33d0m-openclaw-terminal-shell"
  ok "Installed Fr33d0m OpenClaw wrappers"
}

ensure_path() {
  if echo "$PATH" | grep -q "$LOCAL_BIN"; then
    return
  fi

  local shell_rc=""
  if [ -f "$HOME/.bashrc" ]; then
    shell_rc="$HOME/.bashrc"
  elif [ -f "$HOME/.zshrc" ]; then
    shell_rc="$HOME/.zshrc"
  elif [ -f "$HOME/.profile" ]; then
    shell_rc="$HOME/.profile"
  fi

  if [ -n "$shell_rc" ] && ! grep -q 'local/bin' "$shell_rc" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$shell_rc"
    ok "Added ~/.local/bin to PATH in $shell_rc"
  fi

  export PATH="$LOCAL_BIN:$PATH"
}

ensure_user_systemd_ready() {
  if ! command -v systemctl &>/dev/null; then
    return 1
  fi

  local uid
  uid="$(id -u)"

  if command -v loginctl &>/dev/null; then
    sudo loginctl enable-linger "$CURRENT_USER" >/dev/null 2>&1 || true
  fi

  if [ ! -d "/run/user/$uid" ] || [ ! -S "/run/user/$uid/bus" ]; then
    sudo systemctl start "user@${uid}.service" >/dev/null 2>&1 || true
    sleep 1
  fi

  export XDG_RUNTIME_DIR="/run/user/$uid"
  if [ -S "$XDG_RUNTIME_DIR/bus" ]; then
    export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
    return 0
  fi

  return 1
}

install_terminal_service() {
  info "Installing browser terminal service..."
  local systemd_dir="$HOME/.config/systemd/user"
  mkdir -p "$systemd_dir"

  if command -v systemctl &>/dev/null && systemctl list-unit-files ttyd.service >/dev/null 2>&1; then
    sudo systemctl disable --now ttyd.service >/dev/null 2>&1 || true
  fi

  cat > "$systemd_dir/fr33d0m-openclaw-terminal.service" << UNIT
[Unit]
Description=Fr33d0m OpenClaw Browser Terminal
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=OPENCLAW_HOME=$OPENCLAW_HOME
Environment=PATH=$LOCAL_BIN:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/ttyd -p 17681 -i lo -b /terminal -t fontSize=14 -t cursorStyle=bar $LOCAL_BIN/fr33d0m-openclaw-terminal-shell
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
UNIT

  if ensure_user_systemd_ready; then
    systemctl --user daemon-reload
    systemctl --user enable fr33d0m-openclaw-terminal.service >/dev/null 2>&1 || true
    systemctl --user restart fr33d0m-openclaw-terminal.service >/dev/null 2>&1 || true
  else
    warn "Could not reach the user systemd bus; browser terminal service was installed but not started."
  fi

  ok "Browser terminal service configured"
}

install_admin_shell_service() {
  info "Installing Fr33d0m OpenClaw admin shell service..."
  local systemd_dir="$HOME/.config/systemd/user"
  mkdir -p "$systemd_dir"

  cat > "$systemd_dir/fr33d0m-openclaw-shell.service" << UNIT
[Unit]
Description=Fr33d0m OpenClaw Admin Shell
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=OPENCLAW_HOME=$OPENCLAW_HOME
Environment=OPENCLAW_SHELL_HOST=0.0.0.0
Environment=OPENCLAW_SHELL_PORT=18643
EnvironmentFile=$SHELL_ENV_FILE
Environment=PATH=$LOCAL_BIN:/usr/local/bin:/usr/bin:/bin
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/env node $SCRIPT_DIR/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
UNIT

  if ensure_user_systemd_ready; then
    systemctl --user daemon-reload
    systemctl --user enable fr33d0m-openclaw-shell.service >/dev/null 2>&1 || true
    systemctl --user restart fr33d0m-openclaw-shell.service >/dev/null 2>&1 || true
  else
    warn "Could not reach the user systemd bus; admin shell service was installed but not started."
  fi
  ok "Admin shell service configured"
}

open_public_firewall() {
  info "Opening public access to the Fr33d0m OpenClaw shell on port 18643..."
  if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 18643/tcp >/dev/null 2>&1 || true
  else
    sudo iptables -C INPUT -p tcp --dport 18643 -j ACCEPT >/dev/null 2>&1 || \
      sudo iptables -A INPUT -p tcp --dport 18643 -j ACCEPT >/dev/null 2>&1 || true
  fi
  ok "Public shell port configured"
}

print_next_steps() {
  echo ""
  echo -e "${BOLD}${GREEN}┌─────────────────────────────────────────────────────────────┐${RESET}"
  echo -e "${BOLD}${GREEN}│                                                             │${RESET}"
  echo -e "${BOLD}${GREEN}│   Fr33d0m OpenClaw scaffold is ready                        │${RESET}"
  echo -e "${BOLD}${GREEN}│                                                             │${RESET}"
  echo -e "${BOLD}${GREEN}├─────────────────────────────────────────────────────────────┤${RESET}"
  echo -e "${BOLD}│${RESET}  ${CYAN}fr33d0m-openclaw onboard --install-daemon${RESET}                 ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}      Run the official onboarding flow                         ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}                                                             ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}  ${CYAN}fr33d0m-openclaw gateway --port 18789 --verbose${RESET}          ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}      Start the OpenClaw Gateway manually                     ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}                                                             ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}  ${CYAN}Fr33d0m shell${RESET}:    http://0.0.0.0:18643/                 ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}  ${CYAN}OpenClaw Control UI${RESET}: proxied at /openclaw/              ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}  ${CYAN}Browser terminal${RESET}:  proxied at /terminal/              ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}                                                             ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}  Public shell basic auth:                                      ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}    user: ${FR33D0M_OPENCLAW_SHELL_USER}                                         ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}    pass: ${FR33D0M_OPENCLAW_SHELL_PASS}                            ${BOLD}│${RESET}"
  echo -e "${BOLD}${GREEN}└─────────────────────────────────────────────────────────────┘${RESET}"
  echo ""
}

install_system_deps
ensure_node
install_openclaw
ensure_shell_auth_env
install_shell_dependencies
install_wrappers
ensure_path
install_terminal_service
install_admin_shell_service
open_public_firewall

mkdir -p "$OPENCLAW_HOME"

if [ -t 0 ] && [ ! -f "$OPENCLAW_HOME/openclaw.json" ]; then
  warn "OpenClaw is installed, but not yet onboarded."
  warn "Run: fr33d0m-openclaw onboard --install-daemon"
elif [ ! -f "$OPENCLAW_HOME/openclaw.json" ]; then
  warn "No OpenClaw config found yet. Onboard later with:"
  warn "  fr33d0m-openclaw onboard --install-daemon"
fi

print_next_steps
