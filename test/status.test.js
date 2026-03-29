const test = require('node:test')
const assert = require('node:assert/strict')

const { readOpenClawStatus } = require('../src/status')

test('readOpenClawStatus reports healthy runtime details', async () => {
  const payload = await readOpenClawStatus({
    authEnabled: true,
    commandExists: async (command) => command === 'openclaw' || command === 'ttyd',
    configExists: () => true,
    configPath: '/tmp/openclaw.json',
    execCommand: async (command, args) => {
      if (command === 'openclaw' && args[0] === '--version') {
        return { stdout: 'OpenClaw 2026.3.13\n' }
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`)
    },
    fetchJson: async (url) => {
      if (url.includes('/v1/models')) {
        return { ok: true, status: 200 }
      }
      if (url.endsWith('/')) {
        return { ok: true, status: 200 }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    gatewayPort: 18789,
    terminalPort: 17681,
  })

  assert.equal(payload.openclawInstalled, true)
  assert.equal(payload.ttydInstalled, true)
  assert.equal(payload.configExists, true)
  assert.equal(payload.gatewayReachable, true)
  assert.equal(payload.terminalReachable, true)
  assert.equal(payload.openclawVersion, 'OpenClaw 2026.3.13')
  assert.equal(payload.shellAuthEnabled, true)
})

test('readOpenClawStatus tolerates unreachable services', async () => {
  const payload = await readOpenClawStatus({
    authEnabled: false,
    commandExists: async () => false,
    configExists: () => false,
    configPath: '/tmp/openclaw.json',
    execCommand: async () => {
      throw new Error('command missing')
    },
    fetchJson: async () => {
      throw new Error('offline')
    },
    gatewayPort: 18789,
    terminalPort: 17681,
  })

  assert.equal(payload.openclawInstalled, false)
  assert.equal(payload.ttydInstalled, false)
  assert.equal(payload.configExists, false)
  assert.equal(payload.gatewayReachable, false)
  assert.equal(payload.terminalReachable, false)
  assert.equal(payload.shellAuthEnabled, false)
  assert.equal(payload.gatewayStatusCode, null)
})
