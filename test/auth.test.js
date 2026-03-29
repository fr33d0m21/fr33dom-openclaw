const test = require('node:test')
const assert = require('node:assert/strict')

const {
  parseBasicAuthHeader,
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
