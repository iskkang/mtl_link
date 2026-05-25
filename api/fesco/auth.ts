import { fetch as undiciFetch, Agent } from 'undici'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

const FESCO_LOGIN_URL = 'https://my.fesco.com/api/v2/lk/user/login'

// FESCO API can be slow to establish TLS connections from Node 20 on Windows/Vercel dev.
// Use explicit undici Agent timeouts instead of native fetch defaults.
const fescoHttpAgent = new Agent({
  connectTimeout: 45000,
  headersTimeout: 120000,
  bodyTimeout:    120000,
})

export async function loginFesco(): Promise<string> {
  const username = process.env.FESCO_USERNAME
  const password = process.env.FESCO_PASSWORD
  if (!username || !password) {
    throw new Error('FESCO_USERNAME or FESCO_PASSWORD not set')
  }

  const body = {
    usernameOrEmail: username,
    password,
    safeDevice:    false,
    personalData:  false,
    sessionId:     null,
    browser: '{"name":"chrome","version":"131.0.0","os":"Windows 10","type":"browser"}',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any
  try {
    res = await undiciFetch(FESCO_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'X-Lk-Lang':   'en',
      },
      body: JSON.stringify(body),
      dispatcher: fescoHttpAgent,
      // AbortSignal guards against infinite hang if undici Agent timeouts don't fire.
      // Note: connectTimeout (45 s) on the Agent may fire first on slow TLS.
      signal: AbortSignal.timeout(30000),
    })
  } catch (err: any) {
    console.error('[fesco-auth] login fetch failed:', {
      message:      err?.message,
      cause:        err?.cause,
      causeCode:    err?.cause?.code,
      causeName:    err?.cause?.name,
      causeMessage: err?.cause?.message,
      url:          FESCO_LOGIN_URL,
    })
    throw new Error(`FESCO login failed: ${err?.cause?.code || err?.message || 'unknown error'}`)
  }

  const responseText = await res.text()

  if (!res.ok) {
    throw new Error(`FESCO login failed: ${res.status}: ${responseText.substring(0, 200)}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new Error('FESCO login response is not JSON: ' + responseText.substring(0, 100))
  }

  const token = parsed?.data?.token
  if (!token) {
    throw new Error('FESCO login: no token field. Got: ' + responseText.substring(0, 200))
  }

  console.log('[auth] login successful, token length:', token.length)
  return token
}
