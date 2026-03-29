async function readOpenClawStatus({
  authEnabled,
  commandExists,
  configExists,
  configPath,
  execCommand,
  fetchJson,
  gatewayPort,
  terminalPort,
}) {
  const openclawInstalled = await commandExists('openclaw')
  const ttydInstalled = await commandExists('ttyd')

  let gatewayReachable = false
  let gatewayStatusCode = null
  try {
    const response = await fetchJson(`http://127.0.0.1:${gatewayPort}/v1/models`)
    gatewayReachable = response.ok
    gatewayStatusCode = response.status
  } catch {
    gatewayReachable = false
  }

  let terminalReachable = false
  try {
    const response = await fetchJson(`http://127.0.0.1:${terminalPort}/`)
    terminalReachable = response.ok
  } catch {
    terminalReachable = false
  }

  let openclawVersion = ''
  if (openclawInstalled) {
    try {
      const { stdout = '', stderr = '' } = await execCommand('openclaw', ['--version'])
      openclawVersion = (stdout || stderr).trim()
    } catch {
      openclawVersion = 'installed'
    }
  }

  return {
    openclawInstalled,
    ttydInstalled,
    openclawVersion,
    shellAuthEnabled: Boolean(authEnabled),
    configExists: configExists(),
    configPath,
    gatewayReachable,
    gatewayStatusCode,
    gatewayUrl: '/openclaw/',
    terminalReachable,
    terminalUrl: '/terminal/',
    recommendedCommands: [
      'fr33d0m-openclaw onboard --install-daemon',
      'fr33d0m-openclaw gateway --port 18789 --verbose',
      'fr33d0m-openclaw doctor',
    ],
  }
}

module.exports = {
  readOpenClawStatus,
}
