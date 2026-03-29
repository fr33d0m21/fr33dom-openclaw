const test = require('node:test')
const assert = require('node:assert/strict')

const {
  AUTH_SESSION_COOKIE_NAME,
  buildAuthSessionCookie,
  createAuthSessionToken,
  parseBasicAuthHeader,
  parseCookieHeader,
  isAuthorizedRequest,
} = require('../src/auth')

test('parseBasicAuthHeader returns username and password for a valid basic auth header', () => {
  const encoded = Buffer.from('fr33d0m:super-secret').toString('base64')
  const result = parseBasicAuthHeader(`Basic ${encoded}`)
  assert.deepEqual(result, { user: 'fr33d0m', pass: 'super-secret' })
})

test('parseBasicAuthHeader returns null for invalid auth headers', () => {
  assert.equal(parseBasicAuthHeader('Bearer abc'), null)
  assert.equal(parseBasicAuthHeader(''), null)
})

test('isAuthorizedRequest accepts matching credentials', () => {
  const encoded = Buffer.from('fr33d0m:super-secret').toString('base64')
  const result = isAuthorizedRequest(
    { headers: { authorization: `Basic ${encoded}` } },
    { user: 'fr33d0m', pass: 'super-secret' },
  )
  assert.equal(result, true)
})

test('isAuthorizedRequest rejects mismatched credentials', () => {
  const encoded = Buffer.from('fr33d0m:wrong').toString('base64')
  const result = isAuthorizedRequest(
    { headers: { authorization: `Basic ${encoded}` } },
    { user: 'fr33d0m', pass: 'super-secret' },
  )
  assert.equal(result, false)
})

test('parseCookieHeader reads standard cookie header strings', () => {
  const result = parseCookieHeader('foo=bar; hello=world; spaced=value')
  assert.deepEqual(result, {
    foo: 'bar',
    hello: 'world',
    spaced: 'value',
  })
})

test('isAuthorizedRequest accepts a matching auth session cookie', () => {
  const credentials = { user: 'fr33d0m', pass: 'super-secret' }
  const token = createAuthSessionToken(credentials)
  const result = isAuthorizedRequest(
    { headers: { cookie: `${AUTH_SESSION_COOKIE_NAME}=${token}` } },
    credentials,
  )
  assert.equal(result, true)
})

test('buildAuthSessionCookie emits a secure-by-default shell cookie', () => {
  const cookie = buildAuthSessionCookie({ user: 'fr33d0m', pass: 'super-secret' })
  assert.match(cookie, new RegExp(`^${AUTH_SESSION_COOKIE_NAME}=`))
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /SameSite=Lax/)
  assert.match(cookie, /Max-Age=86400/)
})
