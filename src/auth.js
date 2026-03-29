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

function isAuthorizedRequest(req, credentials) {
  const { user = '', pass = '' } = credentials || {}
  if (!user || !pass) {
    return true
  }

  const parsed = parseBasicAuthHeader(req.headers.authorization || '')
  return Boolean(parsed && parsed.user === user && parsed.pass === pass)
}

function basicAuthRealmHeaders(realm = 'Fr33d0m OpenClaw') {
  return { 'WWW-Authenticate': `Basic realm="${realm}"` }
}

module.exports = {
  basicAuthRealmHeaders,
  isAuthorizedRequest,
  parseBasicAuthHeader,
}
