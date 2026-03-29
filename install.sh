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

  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  if [ -S "$XDG_RUNTIME_DIR/bus" ]; then
    export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
  fi

  systemctl --user daemon-reload
  systemctl --user enable fr33d0m-openclaw-terminal.service >/dev/null 2>&1 || true
  systemctl --user restart fr33d0m-openclaw-terminal.service >/dev/null 2>&1 || true

  if command -v loginctl &>/dev/null; then
    sudo loginctl enable-linger "$CURRENT_USER" >/dev/null 2>&1 || true
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
Environment=OPENCLAW_SHELL_HOST=127.0.0.1
Environment=OPENCLAW_SHELL_PORT=18643
Environment=PATH=$LOCAL_BIN:/usr/local/bin:/usr/bin:/bin
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/env node $SCRIPT_DIR/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
UNIT

  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  if [ -S "$XDG_RUNTIME_DIR/bus" ]; then
    export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
  fi

  systemctl --user daemon-reload
  systemctl --user enable fr33d0m-openclaw-shell.service >/dev/null 2>&1 || true
  systemctl --user restart fr33d0m-openclaw-shell.service >/dev/null 2>&1 || true
  ok "Admin shell service configured"
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
  echo -e "${BOLD}│${RESET}  ${CYAN}Fr33d0m shell${RESET}:    http://127.0.0.1:18643/               ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}  ${CYAN}OpenClaw Control UI${RESET}: http://127.0.0.1:18789/             ${BOLD}│${RESET}"
  echo -e "${BOLD}│${RESET}  ${CYAN}Browser terminal${RESET}:  http://127.0.0.1:17681/terminal/      ${BOLD}│${RESET}"
  echo -e "${BOLD}${GREEN}└─────────────────────────────────────────────────────────────┘${RESET}"
  echo ""
}

install_system_deps
ensure_node
install_openclaw
install_wrappers
ensure_path
install_terminal_service
install_admin_shell_service

mkdir -p "$OPENCLAW_HOME"

if [ -t 0 ] && [ ! -f "$OPENCLAW_HOME/openclaw.json" ]; then
  warn "OpenClaw is installed, but not yet onboarded."
  warn "Run: fr33d0m-openclaw onboard --install-daemon"
elif [ ! -f "$OPENCLAW_HOME/openclaw.json" ]; then
  warn "No OpenClaw config found yet. Onboard later with:"
  warn "  fr33d0m-openclaw onboard --install-daemon"
fi

print_next_steps
