const express = require('express')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')
const { promisify } = require('util')
const { createProxyMiddleware } = require('http-proxy-middleware')

const execFileAsync = promisify(execFile)

const app = express()
const server = http.createServer(app)

const HOST = process.env.OPENCLAW_SHELL_HOST || '127.0.0.1'
const PORT = Number(process.env.OPENCLAW_SHELL_PORT || 18643)
const OPENCLAW_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT || 18789)
const TERMINAL_PORT = Number(process.env.OPENCLAW_TERMINAL_PORT || 17681)
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '', '.openclaw')
const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_HOME, 'openclaw.json')

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

function timeoutFetch(url, options = {}, timeoutMs = 2000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

async function commandExists(command) {
  try {
    await execFileAsync('bash', ['-lc', `command -v ${command}`])
    return true
  } catch {
    return false
  }
}

async function readOpenClawStatus() {
  const openclawInstalled = await commandExists('openclaw')
  const ttydInstalled = await commandExists('ttyd')
  const configExists = fs.existsSync(OPENCLAW_CONFIG_PATH)

  let gatewayReachable = false
  let gatewayStatusCode = null
  try {
    const response = await timeoutFetch(`http://127.0.0.1:${OPENCLAW_PORT}/v1/models`)
    gatewayReachable = response.ok
    gatewayStatusCode = response.status
  } catch {
    gatewayReachable = false
  }

  let terminalReachable = false
  try {
    const response = await timeoutFetch(`http://127.0.0.1:${TERMINAL_PORT}/terminal/`)
    terminalReachable = response.ok
  } catch {
    terminalReachable = false
  }

  let openclawVersion = ''
  if (openclawInstalled) {
    try {
      const { stdout, stderr } = await execFileAsync('bash', ['-lc', 'openclaw --version'])
      openclawVersion = (stdout || stderr || '').trim()
    } catch {
      openclawVersion = 'installed'
    }
  }

  return {
    openclawInstalled,
    ttydInstalled,
    openclawVersion,
    configExists,
    configPath: OPENCLAW_CONFIG_PATH,
    gatewayReachable,
    gatewayStatusCode,
    gatewayUrl: `/openclaw/`,
    terminalReachable,
    terminalUrl: `/terminal/`,
    recommendedCommands: [
      'fr33d0m-openclaw onboard --install-daemon',
      'fr33d0m-openclaw gateway --port 18789 --verbose',
      'fr33d0m-openclaw doctor',
    ],
  }
}

app.get('/api/status', async (_req, res) => {
  try {
    const payload = await readOpenClawStatus()
    res.json(payload)
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown status error',
    })
  }
})

const openclawProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${OPENCLAW_PORT}`,
  changeOrigin: false,
  ws: true,
  pathRewrite: (pathValue) => pathValue.replace(/^\/openclaw/, ''),
  onError(err, _req, res) {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
    }
    res.end(`OpenClaw gateway proxy error: ${err.message}`)
  },
})

const terminalProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${TERMINAL_PORT}`,
  changeOrigin: false,
  ws: true,
  onError(err, _req, res) {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
    }
    res.end(`Browser terminal proxy error: ${err.message}`)
  },
})

app.use('/openclaw', openclawProxy)
app.use('/terminal', terminalProxy)

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

server.on('upgrade', openclawProxy.upgrade)
server.on('upgrade', terminalProxy.upgrade)

server.listen(PORT, HOST, () => {
  console.log(`Fr33d0m OpenClaw shell running at http://${HOST}:${PORT}`)
})
