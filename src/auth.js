const crypto = require('crypto')

const AUTH_SESSION_COOKIE_NAME = 'fr33d0m_openclaw_session'

function parseBasicAuthHeader(header = '') {
  if (!header.startsWith('Basic ')) {
    return null
  }

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const [user, ...rest] = decoded.split(':')
    return { user, pass: rest.join(':') }
  } catch {
    return null
  }
}

function parseCookieHeader(header = '') {
  if (!header) {
    return {}
  }

  return Object.fromEntries(
    header
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('=')
        if (separator === -1) {
          return [entry, '']
        }
        return [entry.slice(0, separator), entry.slice(separator + 1)]
      }),
  )
}

function createAuthSessionToken(credentials) {
  const { user = '', pass = '' } = credentials || {}
  if (!user || !pass) {
    return ''
  }

  return crypto.createHash('sha256').update(`${user}:${pass}`).digest('hex')
}

function tokenMatches(left = '', right = '') {
  if (!left || !right || left.length !== right.length) {
    return false
  }

  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

function hasValidAuthSession(req, credentials) {
  const cookies = parseCookieHeader(req.headers.cookie || '')
  return tokenMatches(
    cookies[AUTH_SESSION_COOKIE_NAME] || '',
    createAuthSessionToken(credentials),
  )
}

function isAuthorizedRequest(req, credentials) {
  const { user = '', pass = '' } = credentials || {}
  if (!user || !pass) {
    return true
  }

  if (hasValidAuthSession(req, credentials)) {
    return true
  }

  const parsed = parseBasicAuthHeader(req.headers.authorization || '')
  return Boolean(parsed && parsed.user === user && parsed.pass === pass)
}

function buildAuthSessionCookie(credentials, options = {}) {
  const maxAge = options.maxAge ?? 86400
  const parts = [
    `${AUTH_SESSION_COOKIE_NAME}=${createAuthSessionToken(credentials)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]

  if (options.secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function basicAuthRealmHeaders(realm = 'Fr33d0m OpenClaw') {
  return { 'WWW-Authenticate': `Basic realm="${realm}"` }
}

module.exports = {
  AUTH_SESSION_COOKIE_NAME,
  basicAuthRealmHeaders,
  buildAuthSessionCookie,
  createAuthSessionToken,
  hasValidAuthSession,
  isAuthorizedRequest,
  parseCookieHeader,
  parseBasicAuthHeader,
}
