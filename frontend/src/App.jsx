import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'

const MINIMAX_MODEL = 'openrouter/minimax/minimax-m2.7'

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/runtime', label: 'Runtime' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/skills', label: 'Skills' },
  { to: '/terminal', label: 'Terminal' },
  { to: '/openclaw', label: 'OpenClaw UI' },
]

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload.error || payload.stderr || `Request failed with ${response.status}`
    throw new Error(message)
  }

  return payload
}

function useLoader(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await loader())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  return { data, loading, error, refresh }
}

function formatRelativeAge(ms) {
  if (!ms && ms !== 0) return 'Unknown'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <div className="card-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="card-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}

function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function LoadingBlock({ label = 'Loading shell data...' }) {
  return <div className="loading-block">{label}</div>
}

function ErrorBlock({ error, retry }) {
  return (
    <div className="error-block">
      <p>{error}</p>
      {retry ? (
        <button className="secondary-button" onClick={retry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}

function SurfaceLinks() {
  return (
    <Card title="Operator surfaces" subtitle="Jump into the embedded runtime or open a focused window.">
      <div className="button-row">
        <a className="primary-button" href="/openclaw/" target="_blank" rel="noreferrer">
          Open OpenClaw UI
        </a>
        <a className="secondary-button" href="/terminal/" target="_blank" rel="noreferrer">
          Open terminal
        </a>
      </div>
      <div className="note-grid">
        <div className="note-item">
          <span className="note-label">Proxy model</span>
          <strong>Only the shell stays public on `:18643`</strong>
        </div>
        <div className="note-item">
          <span className="note-label">Embedded routes</span>
          <strong>`/openclaw/` and `/terminal/` stay behind shell auth</strong>
        </div>
      </div>
    </Card>
  )
}

function RuntimeControlsCard({ onAfterAction }) {
  const [busy, setBusy] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  async function runAction(label, url, body) {
    setBusy(label)
    setError('')
    try {
      const payload = await apiRequest(url, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      const nextOutput =
        payload.output ||
        payload.stderr ||
        JSON.stringify(payload.status || payload, null, 2)
      setOutput(nextOutput)
      await onAfterAction?.()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed')
    } finally {
      setBusy('')
    }
  }

  return (
    <Card
      title="Runtime controls"
      subtitle="Operate the OpenClaw gateway and run doctor commands without leaving the shell."
    >
      <div className="button-grid">
        <button
          className="primary-button"
          disabled={Boolean(busy)}
          onClick={() => runAction('Starting gateway', '/api/gateway/start')}
        >
          {busy === 'Starting gateway' ? 'Starting...' : 'Start gateway'}
        </button>
        <button
          className="secondary-button"
          disabled={Boolean(busy)}
          onClick={() => runAction('Restarting gateway', '/api/gateway/restart')}
        >
          {busy === 'Restarting gateway' ? 'Restarting...' : 'Restart gateway'}
        </button>
        <button
          className="secondary-button"
          disabled={Boolean(busy)}
          onClick={() => runAction('Stopping gateway', '/api/gateway/stop')}
        >
          {busy === 'Stopping gateway' ? 'Stopping...' : 'Stop gateway'}
        </button>
        <button
          className="ghost-button"
          disabled={Boolean(busy)}
          onClick={() => runAction('Running doctor', '/api/doctor')}
        >
          {busy === 'Running doctor' ? 'Running doctor...' : 'Doctor'}
        </button>
        <button
          className="ghost-button"
          disabled={Boolean(busy)}
          onClick={() => runAction('Repairing runtime', '/api/doctor', { repair: true })}
        >
          {busy === 'Repairing runtime' ? 'Repairing...' : 'Doctor repair'}
        </button>
        <button
          className="ghost-button"
          disabled={Boolean(busy)}
          onClick={() => runAction('Forcing repair', '/api/doctor', { repair: true, force: true })}
        >
          {busy === 'Forcing repair' ? 'Repairing...' : 'Doctor force'}
        </button>
      </div>
      {error ? <ErrorBlock error={error} /> : null}
      <pre className="terminal-block">{output || 'Action output will appear here.'}</pre>
    </Card>
  )
}

function ModelSetupCard({ modelsStatus, onUpdated }) {
  const [form, setForm] = useState({
    provider: 'openrouter',
    model: MINIMAX_MODEL,
    imageModel: MINIMAX_MODEL,
    authToken: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setForm((current) => ({
      ...current,
      model: modelsStatus?.defaultModel || current.model,
      imageModel: modelsStatus?.imageModel || current.imageModel,
    }))
  }, [modelsStatus?.defaultModel, modelsStatus?.imageModel])

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        provider: form.provider,
        model: form.model,
        imageModel: form.imageModel,
      }
      if (form.authToken.trim()) {
        payload.authToken = form.authToken.trim()
      }
      await apiRequest('/api/models/set', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setMessage('Model settings updated.')
      setForm((current) => ({ ...current, authToken: '' }))
      await onUpdated?.()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Model update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="OpenRouter + MiniMax setup" subtitle="Set the OpenRouter key and keep the default models on MiniMax 2.7.">
      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          <span>Provider</span>
          <input
            value={form.provider}
            onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
            placeholder="openrouter"
          />
        </label>
        <label>
          <span>Default model</span>
          <input
            value={form.model}
            onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            placeholder={MINIMAX_MODEL}
          />
        </label>
        <label>
          <span>Image model</span>
          <input
            value={form.imageModel}
            onChange={(event) => setForm((current) => ({ ...current, imageModel: event.target.value }))}
            placeholder={MINIMAX_MODEL}
          />
        </label>
        <label>
          <span>OpenRouter API key</span>
          <input
            type="password"
            value={form.authToken}
            onChange={(event) => setForm((current) => ({ ...current, authToken: event.target.value }))}
            placeholder="Paste only when rotating or setting a new key"
          />
        </label>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                provider: 'openrouter',
                model: MINIMAX_MODEL,
                imageModel: MINIMAX_MODEL,
              }))
            }
          >
            Apply MiniMax 2.7 preset
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Saving...' : 'Save model settings'}
          </button>
        </div>
      </form>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <ErrorBlock error={error} /> : null}
      <div className="meta-list">
        <div className="meta-row">
          <span>Current default</span>
          <strong>{modelsStatus?.defaultModel || 'Not configured yet'}</strong>
        </div>
        <div className="meta-row">
          <span>Current image model</span>
          <strong>{modelsStatus?.imageModel || 'Not configured yet'}</strong>
        </div>
        <div className="meta-row">
          <span>Configured auth profiles</span>
          <strong>{modelsStatus?.auth?.oauth?.profiles?.length || 0}</strong>
        </div>
      </div>
    </Card>
  )
}

function AutonomyCard({ config, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function applyAutonomousProfile() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest('/api/config', {
        method: 'PATCH',
        body: JSON.stringify({
          updates: [
            { path: 'tools.exec.ask', value: 'off' },
            { path: 'tools.exec.security', value: 'full' },
            { path: 'tools.elevated.enabled', value: false },
          ],
        }),
      })
      setMessage('Autonomous runtime defaults applied.')
      await onUpdated?.()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Config update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Autonomy profile" subtitle="Keep OpenClaw hands-off and fully autonomous by default.">
      <div className="meta-list">
        <div className="meta-row">
          <span>`tools.exec.ask`</span>
          <strong>{String(config?.values?.execAsk ?? 'unknown')}</strong>
        </div>
        <div className="meta-row">
          <span>`tools.exec.security`</span>
          <strong>{String(config?.values?.execSecurity ?? 'unknown')}</strong>
        </div>
        <div className="meta-row">
          <span>`tools.elevated.enabled`</span>
          <strong>{String(config?.values?.elevatedEnabled ?? 'unknown')}</strong>
        </div>
      </div>
      <div className="button-row">
        <button className="primary-button" disabled={busy} onClick={applyAutonomousProfile}>
          {busy ? 'Applying...' : 'Apply autonomous defaults'}
        </button>
        <button className="secondary-button" disabled={busy} onClick={() => onUpdated?.()}>
          Refresh config
        </button>
      </div>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <ErrorBlock error={error} /> : null}
    </Card>
  )
}

function HomePage() {
  const { data, loading, error, refresh } = useLoader(
    async () => {
      const [status, config, models] = await Promise.all([
        apiRequest('/api/status'),
        apiRequest('/api/config'),
        apiRequest('/api/models/status'),
      ])

      return { status, config, models }
    },
    [],
  )

  const status = data?.status
  const cards = [
    {
      label: 'OpenClaw CLI',
      value: status?.openclawInstalled ? status.openclawVersion || 'Installed' : 'Missing',
      tone: status?.openclawInstalled ? 'success' : 'warn',
    },
    {
      label: 'Gateway',
      value: status?.gatewayReachable ? 'Reachable' : 'Offline',
      tone: status?.gatewayReachable ? 'success' : 'warn',
    },
    {
      label: 'Terminal',
      value: status?.terminalReachable ? 'Reachable' : 'Unavailable',
      tone: status?.terminalReachable ? 'success' : 'warn',
    },
    {
      label: 'Config',
      value: status?.configExists ? 'Present' : 'Missing',
      tone: status?.configExists ? 'success' : 'warn',
    },
  ]

  if (loading) return <LoadingBlock label="Loading dashboard home..." />
  if (error) return <ErrorBlock error={error} retry={refresh} />

  return (
    <div className="page-stack">
      <Card
        className="hero-card"
        title="Fr33d0m OpenClaw operator shell"
        subtitle="A richer shell for controlling the OpenClaw gateway, tuning runtime config, and embedding the main operator surfaces behind one branded dashboard."
        actions={
          <button className="secondary-button" onClick={refresh}>
            Refresh
          </button>
        }
      >
        <div className="hero-meta">
          <Badge tone={status?.shellAuthEnabled ? 'success' : 'warn'}>
            {status?.shellAuthEnabled ? 'Shell auth enabled' : 'Shell auth disabled'}
          </Badge>
          <Badge tone={status?.dashboardBuildPresent ? 'success' : 'warn'}>
            {status?.dashboardBuildPresent ? 'React shell build present' : 'Legacy public fallback active'}
          </Badge>
        </div>
      </Card>

      <div className="stats-grid">
        {cards.map((card) => (
          <Card key={card.label} className="stat-card">
            <span className="stat-label">{card.label}</span>
            <strong className={`stat-value stat-${card.tone}`}>{card.value}</strong>
          </Card>
        ))}
      </div>

      <div className="split-grid">
        <RuntimeControlsCard onAfterAction={refresh} />
        <ModelSetupCard modelsStatus={data.models} onUpdated={refresh} />
      </div>

      <div className="split-grid">
        <AutonomyCard config={data.config} onUpdated={refresh} />
        <SurfaceLinks />
      </div>

      <div className="split-grid">
        <Card title="Channel summary" subtitle="Read-only status from `openclaw status --json`.">
          <ul className="bullet-list">
            {(status?.channels || []).map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </Card>
        <Card title="Agents" subtitle="Default agent and session counts discovered by OpenClaw status.">
          <div className="meta-list">
            <div className="meta-row">
              <span>Default agent</span>
              <strong>{status?.agents?.defaultId || 'Unknown'}</strong>
            </div>
            <div className="meta-row">
              <span>Total sessions</span>
              <strong>{status?.agents?.totalSessions ?? 'Unknown'}</strong>
            </div>
            <div className="meta-row">
              <span>Bootstrap pending</span>
              <strong>{status?.agents?.bootstrapPendingCount ?? 'Unknown'}</strong>
            </div>
          </div>
          <div className="chip-row">
            {(status?.agents?.agents || []).map((agent) => (
              <Badge key={agent.id} tone={agent.bootstrapPending ? 'warn' : 'success'}>
                {agent.id}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function RuntimePage() {
  const { data, loading, error, refresh } = useLoader(
    async () => {
      const [gateway, logs] = await Promise.all([
        apiRequest('/api/gateway/status'),
        apiRequest('/api/gateway/logs'),
      ])
      return { gateway, logs }
    },
    [],
  )

  if (loading) return <LoadingBlock label="Loading runtime state..." />
  if (error) return <ErrorBlock error={error} retry={refresh} />

  const gateway = data.gateway

  return (
    <div className="page-stack">
      <div className="split-grid">
        <RuntimeControlsCard onAfterAction={refresh} />
        <Card
          title="Gateway status"
          subtitle="Thin wrapper over `openclaw gateway status --json`."
          actions={
            <button className="secondary-button" onClick={refresh}>
              Refresh
            </button>
          }
        >
          <div className="meta-list">
            <div className="meta-row">
              <span>Loaded</span>
              <strong>{String(gateway?.service?.loaded ?? 'unknown')}</strong>
            </div>
            <div className="meta-row">
              <span>Runtime</span>
              <strong>{gateway?.service?.runtime?.status || 'Unknown'}</strong>
            </div>
            <div className="meta-row">
              <span>Port</span>
              <strong>{gateway?.gateway?.port || 'Unknown'}</strong>
            </div>
            <div className="meta-row">
              <span>Probe URL</span>
              <strong>{gateway?.gateway?.probeUrl || 'Unknown'}</strong>
            </div>
          </div>
          <pre className="terminal-block">{JSON.stringify(gateway, null, 2)}</pre>
        </Card>
      </div>

      <Card
        title="Gateway logs"
        subtitle={`Source: ${data.logs?.source || 'unknown'}`}
        actions={
          <button className="secondary-button" onClick={refresh}>
            Refresh logs
          </button>
        }
      >
        <pre className="terminal-block">{data.logs?.output || 'No logs available.'}</pre>
      </Card>
    </div>
  )
}

function SessionsPage() {
  const [allAgents, setAllAgents] = useState(true)
  const [agent, setAgent] = useState('')
  const [active, setActive] = useState('')

  const { data, loading, error, refresh } = useLoader(
    async () => {
      const search = new URLSearchParams()
      search.set('allAgents', String(allAgents))
      if (!allAgents && agent.trim()) {
        search.set('agent', agent.trim())
      }
      if (active.trim()) {
        search.set('active', active.trim())
      }
      return apiRequest(`/api/sessions?${search.toString()}`)
    },
    [allAgents, agent, active],
  )

  const sessions = data?.sessions || []

  return (
    <div className="page-stack">
      <Card
        title="Sessions"
        subtitle="Read-first history from `openclaw sessions --json`."
        actions={
          <button className="secondary-button" onClick={refresh}>
            Refresh
          </button>
        }
      >
        <div className="filters-grid">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={allAgents}
              onChange={(event) => setAllAgents(event.target.checked)}
            />
            <span>Aggregate all agents</span>
          </label>
          <label>
            <span>Agent id</span>
            <input
              disabled={allAgents}
              placeholder="main"
              value={agent}
              onChange={(event) => setAgent(event.target.value)}
            />
          </label>
          <label>
            <span>Active within minutes</span>
            <input
              placeholder="120"
              value={active}
              onChange={(event) => setActive(event.target.value)}
            />
          </label>
        </div>
        {loading ? <LoadingBlock label="Loading sessions..." /> : null}
        {error ? <ErrorBlock error={error} retry={refresh} /> : null}
        {!loading && !error ? (
          <>
            <div className="meta-list">
              <div className="meta-row">
                <span>Store path</span>
                <strong>{data?.path || 'Mixed agent stores'}</strong>
              </div>
              <div className="meta-row">
                <span>Session count</span>
                <strong>{data?.count ?? sessions.length}</strong>
              </div>
            </div>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Kind</th>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Last active</th>
                    <th>Session id</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 40).map((session) => (
                    <tr key={`${session.sessionId}-${session.key}`}>
                      <td>{session.agentId || 'main'}</td>
                      <td>{session.kind || 'direct'}</td>
                      <td>{session.model || 'Unknown'}</td>
                      <td>{session.totalTokens ?? 'n/a'}</td>
                      <td>{formatRelativeAge(session.ageMs)}</td>
                      <td className="mono-cell">{session.sessionId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  )
}

function SkillsPage() {
  const { data, loading, error, refresh } = useLoader(
    async () => {
      const [skillsPayload, readiness] = await Promise.all([
        apiRequest('/api/skills?verbose=true'),
        apiRequest('/api/skills/check'),
      ])
      return { skillsPayload, readiness }
    },
    [],
  )
  const [selectedName, setSelectedName] = useState('')
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [detailError, setDetailError] = useState('')

  const skills = data?.skillsPayload?.skills || []
  const summary = useMemo(() => {
    const eligible = skills.filter((skill) => skill.eligible).length
    return {
      total: skills.length,
      eligible,
      blocked: skills.length - eligible,
    }
  }, [skills])

  useEffect(() => {
    if (!selectedName) {
      setSelectedSkill(null)
      setDetailError('')
      return
    }

    apiRequest(`/api/skills/${selectedName}`)
      .then((payload) => {
        setSelectedSkill(payload)
        setDetailError('')
      })
      .catch((loadError) => {
        setSelectedSkill(null)
        setDetailError(loadError instanceof Error ? loadError.message : 'Failed to load skill info')
      })
  }, [selectedName])

  return (
    <div className="page-stack">
      <div className="split-grid">
        <Card
          title="Skills catalog"
          subtitle="Read-only view over `openclaw skills list --json`."
          actions={
            <button className="secondary-button" onClick={refresh}>
              Refresh
            </button>
          }
        >
          {loading ? <LoadingBlock label="Loading skills..." /> : null}
          {error ? <ErrorBlock error={error} retry={refresh} /> : null}
          {!loading && !error ? (
            <>
              <div className="chip-row">
                <Badge tone="success">{summary.eligible} eligible</Badge>
                <Badge tone="neutral">{summary.total} total</Badge>
                <Badge tone={summary.blocked ? 'warn' : 'success'}>{summary.blocked} blocked</Badge>
              </div>
              <div className="skill-list">
                {skills.slice(0, 60).map((skill) => (
                  <button
                    key={skill.name}
                    className={`skill-item ${selectedName === skill.name ? 'skill-item-active' : ''}`}
                    onClick={() => setSelectedName(skill.name)}
                  >
                    <div>
                      <strong>{skill.name}</strong>
                      <p>{skill.description}</p>
                    </div>
                    <Badge tone={skill.eligible ? 'success' : 'warn'}>
                      {skill.eligible ? 'ready' : 'missing setup'}
                    </Badge>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Card>

        <Card title="Skill detail" subtitle="Click a skill to inspect its full JSON metadata.">
          {selectedName ? null : <p className="card-subtitle">Choose a skill from the catalog.</p>}
          {detailError ? <ErrorBlock error={detailError} /> : null}
          <pre className="terminal-block">
            {selectedSkill
              ? JSON.stringify(selectedSkill, null, 2)
              : 'No skill selected yet.'}
          </pre>
        </Card>
      </div>

      <Card title="Readiness check" subtitle="Thin wrapper over `openclaw skills check --json`.">
        <pre className="terminal-block">{JSON.stringify(data?.readiness || {}, null, 2)}</pre>
      </Card>
    </div>
  )
}

function EmbeddedSurfacePage({ title, subtitle, src }) {
  const [frameKey, setFrameKey] = useState(0)

  return (
    <div className="page-stack">
      <Card
        title={title}
        subtitle={subtitle}
        actions={
          <div className="button-row">
            <button className="secondary-button" onClick={() => setFrameKey((value) => value + 1)}>
              Reconnect
            </button>
            <a className="primary-button" href={src} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          </div>
        }
      >
        <iframe
          key={frameKey}
          className="embedded-frame"
          src={src}
          title={title}
          allow="clipboard-read; clipboard-write"
        />
      </Card>
    </div>
  )
}

function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="eyebrow">Fr33d0m</span>
          <h1>OpenClaw shell</h1>
          <p>One operator dashboard for runtime control, model setup, sessions, skills, terminal access, and the native UI proxy.</p>
        </div>
        <nav className="nav-list">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>Raw shell port</span>
          <strong>:18643</strong>
        </div>
      </aside>
      <main className="content-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">Fr33d0m Operator Console</span>
            <h2>Keep OpenClaw manageable from one branded shell</h2>
          </div>
          <div className="button-row">
            <a className="secondary-button" href="/terminal/" target="_blank" rel="noreferrer">
              Terminal
            </a>
            <a className="primary-button" href="/openclaw/" target="_blank" rel="noreferrer">
              OpenClaw UI
            </a>
          </div>
        </header>
        <div className="content-body">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/runtime" element={<RuntimePage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route
              path="/terminal"
              element={
                <EmbeddedSurfacePage
                  title="Browser terminal"
                  subtitle="The existing ttyd shell, embedded in-app and still available in a standalone tab."
                  src="/terminal/"
                />
              }
            />
            <Route
              path="/openclaw"
              element={
                <EmbeddedSurfacePage
                  title="OpenClaw UI"
                  subtitle="The native OpenClaw control surface, still proxied through the public Fr33d0m shell."
                  src="/openclaw/"
                />
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
