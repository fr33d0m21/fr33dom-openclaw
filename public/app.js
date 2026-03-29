const byId = (id) => document.getElementById(id)

function setStatus(el, ok, yesText, noText) {
  if (!el) return
  el.textContent = ok ? yesText : noText
  el.className = ok ? 'ok' : 'warn'
}

async function loadStatus() {
  const res = await fetch('/api/status')
  if (!res.ok) throw new Error(`Status request failed: ${res.status}`)
  const status = await res.json()

  setStatus(byId('openclaw-installed'), status.openclawInstalled, status.openclawVersion || 'Installed', 'Missing')
  setStatus(byId('gateway-status'), status.gatewayReachable, 'Reachable', 'Not running')
  setStatus(byId('terminal-status'), status.terminalReachable, 'Reachable', 'Unavailable')
  setStatus(byId('config-status'), status.configExists, 'Present', 'Not onboarded')

  const commands = byId('commands')
  if (commands) {
    commands.innerHTML = ''
    for (const command of status.recommendedCommands || []) {
      const item = document.createElement('li')
      item.innerHTML = `<code>${command}</code>`
      commands.appendChild(item)
    }
  }
}

async function main() {
  const refresh = byId('refresh')
  if (refresh) {
    refresh.addEventListener('click', () => {
      loadStatus().catch((error) => {
        console.error(error)
        alert(error.message)
      })
    })
  }

  try {
    await loadStatus()
  } catch (error) {
    console.error(error)
    alert(error.message)
  }
}

main()
