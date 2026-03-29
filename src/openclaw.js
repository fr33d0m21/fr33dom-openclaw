const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)

const DEFAULT_BUFFER = 1024 * 1024 * 4

async function execCommand(command, args = [], options = {}) {
  const { input, ...rest } = options
  return execFileAsync(command, args, {
    env: process.env,
    encoding: 'utf8',
    maxBuffer: DEFAULT_BUFFER,
    input,
    ...rest,
  })
}

async function execOpenClaw(args = [], options = {}) {
  return execCommand('openclaw', args, options)
}

async function readJsonOutput(command, args = [], options = {}) {
  const { stdout } = await execCommand(command, args, options)
  return stdout ? JSON.parse(stdout) : null
}

async function readOpenClawJson(args = [], options = {}) {
  return readJsonOutput('openclaw', args, options)
}

async function readOpenClawText(args = [], options = {}) {
  const { stdout = '', stderr = '' } = await execOpenClaw(args, options)
  return (stdout || stderr).trim()
}

async function commandExists(command) {
  try {
    await execCommand('bash', ['-lc', `command -v ${command}`])
    return true
  } catch {
    return false
  }
}

function timeoutFetch(url, options = {}, timeoutMs = 2000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

async function getConfigValue(configPath) {
  return readOpenClawJson(['config', 'get', configPath, '--json'])
}

async function setConfigValue(configPath, value) {
  return execOpenClaw(['config', 'set', configPath, JSON.stringify(value)])
}

async function pasteProviderToken({ provider, token, profileId, expiresIn }) {
  const args = ['models', 'auth', 'paste-token', '--provider', provider]
  if (profileId) {
    args.push('--profile-id', profileId)
  }
  if (expiresIn) {
    args.push('--expires-in', expiresIn)
  }

  return execOpenClaw(args, { input: `${token.trim()}\n` })
}

async function readGatewayLogs({ lines = 120 } = {}) {
  const safeLines = String(Math.max(20, Math.min(Number(lines) || 120, 400)))
  const serviceUnits = ['openclaw-gateway.service', 'ai.openclaw.gateway.service']

  for (const unit of serviceUnits) {
    try {
      const { stdout } = await execCommand('journalctl', [
        '--user',
        '--unit',
        unit,
        '-n',
        safeLines,
        '--no-pager',
      ])

      if (stdout.trim()) {
        return {
          source: `journalctl:${unit}`,
          output: stdout.trim(),
        }
      }
    } catch {
      // keep trying other service names or fall back below
    }
  }

  try {
    const payload = await readOpenClawJson(['gateway', 'status', '--json'])
    return {
      source: 'openclaw gateway status --json',
      output: JSON.stringify(payload, null, 2),
    }
  } catch {
    const output = await readOpenClawText(['gateway', 'status'])
    return {
      source: 'openclaw gateway status',
      output,
    }
  }
}

module.exports = {
  commandExists,
  execCommand,
  execOpenClaw,
  getConfigValue,
  pasteProviderToken,
  readGatewayLogs,
  readJsonOutput,
  readOpenClawJson,
  readOpenClawText,
  setConfigValue,
  timeoutFetch,
}
