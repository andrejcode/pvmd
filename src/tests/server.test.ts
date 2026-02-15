import type { Server } from 'node:http'
import { createServer } from '../server'

const HTML_WITH_APP_SCRIPT = [
  '<!doctype html>',
  '<html><body>',
  '<main><p>content</p></main>',
  '<script data-pvmd-app></script>',
  '</body></html>',
].join('\n')

function listenOnRandomPort(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port =
        typeof address === 'object' && address !== null && 'port' in address
          ? address.port
          : 0
      resolve(port)
    })

    server.once('error', reject)
  })
}

describe('createServer', () => {
  test('GET / returns 200 with security headers, CSP with nonce, and matching nonce in HTML', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html')

      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('referrer-policy')).toBe('no-referrer')
      expect(res.headers.get('x-frame-options')).toBe('DENY')
      expect(res.headers.get('permissions-policy')).toContain('geolocation=()')

      const csp = res.headers.get('content-security-policy')
      expect(csp).toBeDefined()
      expect(csp).toContain("default-src 'none'")

      const body = await res.text()
      const nonceMatch = csp?.match(/script-src 'nonce-([^']+)'/)
      expect(nonceMatch).toBeDefined()
      const nonce = nonceMatch?.[1]
      expect(nonce).toBeDefined()
      expect(body).toContain(`nonce="${nonce}"`)
      expect(body).toContain('data-pvmd-app')
      expect(body).toContain('<main><p>content</p></main>')
    } finally {
      server.close()
    }
  })

  test('unhandled path returns 404 with JSON body', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/some-path`)
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toBe('application/json')

      const json = (await res.json()) as { error: string; message: string }
      expect(json).toMatchObject({
        error: 'Not Found',
        message: 'Cannot GET /some-path',
      })
    } finally {
      server.close()
    }
  })

  test('POST / returns 404', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
      })
      expect(res.status).toBe(404)

      const json = (await res.json()) as { message: string }
      expect(json.message).toBe('Cannot POST /')
    } finally {
      server.close()
    }
  })
})
