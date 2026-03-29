const express = require('express')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { createProxyMiddleware } = require('http-proxy-middleware')

const { basicAuthRealmHeaders, isAuthorizedRequest } = require('./src/auth')
const {
  commandExists,
  execOpenClaw,
  getConfigValue,
  pasteProviderToken,
  readGatewayLogs,
  readOpenClawJson,
  readOpenClawText,
  setConfigValue,
  timeoutFetch,
} = require('./src/openclaw')
const { readOpenClawStatus } = require('./src/status')

const app = express()
const server = http.createServer(app)

const HOST = process.env.OPENCLAW_SHELL_HOST || '127.0.0.1'
const PORT = Number(process.env.OPENCLAW_SHELL_PORT || 18643)
const OPENCLAW_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT || 18789)
const TERMINAL_PORT = Number(process.env.OPENCLAW_TERMINAL_PORT || 17681)
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '', '.openclaw')
const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_HOME, 'openclaw.json')
const SHELL_AUTH_USER = process.env.FR33D0M_OPENCLAW_SHELL_USER || ''
const SHELL_AUTH_PASS = process.env.FR33D0M_OPENCLAW_SHELL_PASS || ''
const FRONTEND_DIST_DIR = path.join(__dirname, 'frontend', 'dist')
const LEGACY_PUBLIC_DIR = path.join(__dirname, 'public')
const STATIC_DIR = fs.existsSync(path.join(FRONTEND_DIST_DIR, 'index.html'))
  ? FRONTEND_DIST_DIR
  : LEGACY_PUBLIC_DIR
const authCredentials = {
  user: SHELL_AUTH_USER,
  pass: SHELL_AUTH_PASS,
}

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

function boolParam(value) {
  return value === true || value === 'true' || value === '1'
}

function errorPayload(error, fallback = 'Unexpected shell error') {
  return {
    error: error instanceof Error ? error.message : fallback,
    stdout: typeof error?.stdout === 'string' ? error.stdout.trim() : '',
    stderr: typeof error?.stderr === 'string' ? error.stderr.trim() : '',
  }
}

function sendAuthChallenge(res, message) {
  res.setHeader('WWW-Authenticate', basicAuthRealmHeaders()['WWW-Authenticate'])
  return res.status(401).send(message)
}

function requireBasicAuth(req, res, next) {
  if (isAuthorizedRequest(req, authCredentials)) {
    return next()
  }

  return sendAuthChallenge(
    res,
    req.headers.authorization ? 'Invalid credentials' : 'Authentication required',
  )
}

async function respondJson(res, operation) {
  try {
    res.json(await operation())
  } catch (error) {
    res.status(500).json(errorPayload(error))
  }
}

async function maybeJson(promiseFactory) {
  try {
    return await promiseFactory()
  } catch {
    return null
  }
}

async function readMergedStatus() {
  const baseline = await readOpenClawStatus({
    authEnabled: Boolean(SHELL_AUTH_USER && SHELL_AUTH_PASS),
    commandExists,
    configExists: () => fs.existsSync(OPENCLAW_CONFIG_PATH),
    configPath: OPENCLAW_CONFIG_PATH,
    execCommand: execOpenClaw,
    fetchJson: (url) => timeoutFetch(url),
    gatewayPort: OPENCLAW_PORT,
    terminalPort: TERMINAL_PORT,
  })

  if (!baseline.openclawInstalled) {
    return {
      ...baseline,
      dashboardBuildPresent: STATIC_DIR === FRONTEND_DIST_DIR,
      runtime: null,
      gatewayService: null,
      models: null,
      channels: [],
      agents: null,
    }
  }

  const [runtime, gatewayService, models] = await Promise.all([
    maybeJson(() => readOpenClawJson(['status', '--json'])),
    maybeJson(() => readOpenClawJson(['gateway', 'status', '--json'])),
    maybeJson(() => readOpenClawJson(['models', 'status', '--json'])),
  ])

  return {
    ...baseline,
    dashboardBuildPresent: STATIC_DIR === FRONTEND_DIST_DIR,
    runtime,
    gatewayService,
    models,
    channels: runtime?.channelSummary || [],
    agents: runtime?.agents || null,
  }
}

async function readConfigSnapshot() {
  const configKeys = {
    defaultModel: 'agents.defaults.model.primary',
    imageModel: 'agents.defaults.imageModel.primary',
    execAsk: 'tools.exec.ask',
    execSecurity: 'tools.exec.security',
    execTimeoutSec: 'tools.exec.timeoutSec',
    elevatedEnabled: 'tools.elevated.enabled',
    gatewayMode: 'gateway.mode',
    gatewayBind: 'gateway.bind',
    shellEnvEnabled: 'env.shellEnv.enabled',
  }

  const entries = await Promise.all(
    Object.entries(configKeys).map(async ([key, configPath]) => {
      try {
        return [key, await getConfigValue(configPath)]
      } catch {
        return [key, null]
      }
    }),
  )

  return {
    configPath: OPENCLAW_CONFIG_PATH,
    exists: fs.existsSync(OPENCLAW_CONFIG_PATH),
    values: Object.fromEntries(entries),
  }
}

async function runGatewayAction(action) {
  const output = await readOpenClawText(['gateway', action])
  return {
    action,
    output,
    status: await maybeJson(() => readOpenClawJson(['gateway', 'status', '--json'])),
  }
}

app.use(requireBasicAuth)

app.get('/api/status', async (_req, res) => {
  await respondJson(res, () => readMergedStatus())
})

app.get('/api/gateway/status', async (_req, res) => {
  await respondJson(res, () => readOpenClawJson(['gateway', 'status', '--json']))
})

app.post('/api/gateway/start', async (_req, res) => {
  await respondJson(res, () => runGatewayAction('start'))
})

app.post('/api/gateway/stop', async (_req, res) => {
  await respondJson(res, () => runGatewayAction('stop'))
})

app.post('/api/gateway/restart', async (_req, res) => {
  await respondJson(res, () => runGatewayAction('restart'))
})

app.get('/api/gateway/logs', async (req, res) => {
  await respondJson(res, () => readGatewayLogs({ lines: req.query.lines }))
})

app.post('/api/doctor', async (req, res) => {
  await respondJson(res, async () => {
    const args = ['doctor', '--non-interactive', '--yes']
    if (boolParam(req.body?.repair) || boolParam(req.body?.fix)) {
      args.push('--repair')
    }
    if (boolParam(req.body?.force)) {
      args.push('--force')
    }

    return {
      command: `openclaw ${args.join(' ')}`,
      output: await readOpenClawText(args),
    }
  })
})

app.get('/api/config', async (_req, res) => {
  await respondJson(res, () => readConfigSnapshot())
})

app.patch('/api/config', async (req, res) => {
  await respondJson(res, async () => {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : []
    if (updates.length === 0) {
      throw new Error('PATCH /api/config requires a non-empty updates array')
    }

    for (const update of updates) {
      if (!update?.path) {
        throw new Error('Every config update must include a path')
      }
      await setConfigValue(update.path, update.value)
    }

    return {
      updated: updates,
      config: await readConfigSnapshot(),
    }
  })
})

app.get('/api/models/status', async (_req, res) => {
  await respondJson(res, () => readOpenClawJson(['models', 'status', '--json']))
})

app.post('/api/models/set', async (req, res) => {
  await respondJson(res, async () => {
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : ''
    const imageModel = typeof req.body?.imageModel === 'string' ? req.body.imageModel.trim() : ''
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim() : 'openrouter'
    const profileId = typeof req.body?.profileId === 'string' ? req.body.profileId.trim() : `${provider}:default`
    const authToken = typeof req.body?.authToken === 'string' ? req.body.authToken.trim() : ''
    const expiresIn = typeof req.body?.expiresIn === 'string' ? req.body.expiresIn.trim() : ''
    const updated = []

    if (!model && !imageModel && !authToken) {
      throw new Error('Provide at least one of model, imageModel, or authToken')
    }

    if (authToken) {
      await pasteProviderToken({ provider, token: authToken, profileId, expiresIn })
      updated.push(`auth:${profileId}`)
    }

    if (model) {
      await execOpenClaw(['models', 'set', model])
      updated.push(`model:${model}`)
    }

    if (imageModel) {
      await execOpenClaw(['models', 'set-image', imageModel])
      updated.push(`imageModel:${imageModel}`)
    }

    return {
      updated,
      status: await readOpenClawJson(['models', 'status', '--json']),
    }
  })
})

app.get('/api/sessions', async (req, res) => {
  await respondJson(res, async () => {
    const args = ['sessions', '--json']
    if (boolParam(req.query.allAgents) || !req.query.agent) {
      args.push('--all-agents')
    } else if (typeof req.query.agent === 'string' && req.query.agent.trim()) {
      args.push('--agent', req.query.agent.trim())
    }

    if (typeof req.query.active === 'string' && req.query.active.trim()) {
      args.push('--active', req.query.active.trim())
    }

    return readOpenClawJson(args)
  })
})

app.get('/api/skills', async (req, res) => {
  await respondJson(res, async () => {
    const args = ['skills', 'list', '--json']
    if (boolParam(req.query.eligible)) {
      args.push('--eligible')
    }
    if (boolParam(req.query.verbose)) {
      args.push('--verbose')
    }
    return readOpenClawJson(args)
  })
})

app.get('/api/skills/check', async (_req, res) => {
  await respondJson(res, () => readOpenClawJson(['skills', 'check', '--json']))
})

app.get('/api/skills/:name', async (req, res) => {
  await respondJson(res, () => readOpenClawJson(['skills', 'info', req.params.name, '--json']))
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
app.use(express.static(STATIC_DIR))

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' })
  }
  return res.sendFile(path.join(STATIC_DIR, 'index.html'))
})

function upgradeAuthFailed(socket) {
  socket.write('HTTP/1.1 401 Unauthorized\r\n')
  socket.write(`WWW-Authenticate: ${basicAuthRealmHeaders()['WWW-Authenticate']}\r\n`)
  socket.write('Connection: close\r\n')
  socket.write('\r\n')
  socket.destroy()
}

function upgradeAuthorized(req) {
  return isAuthorizedRequest(req, authCredentials)
}

server.on('upgrade', (req, socket, head) => {
  if (!upgradeAuthorized(req)) {
    return upgradeAuthFailed(socket)
  }

  if (req.url && req.url.startsWith('/terminal')) {
    req.url = req.url.replace(/^\/terminal/, '') || '/'
    return terminalProxy.upgrade(req, socket, head)
  }

  if (req.url && req.url.startsWith('/openclaw')) {
    req.url = req.url.replace(/^\/openclaw/, '') || '/'
    return openclawProxy.upgrade(req, socket, head)
  }

  socket.destroy()
})

server.listen(PORT, HOST, () => {
  console.log(`Fr33d0m OpenClaw shell running at http://${HOST}:${PORT}`)
})
