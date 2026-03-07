import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config } from '@/cli/config'
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

  test('GET / with httpsOnly restricts img-src to https: in CSP', async () => {
    config.httpsOnly = true
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      const csp = res.headers.get('content-security-policy')
      expect(csp).toContain('img-src https: data:')
      expect(csp).not.toContain('img-src *')
    } finally {
      config.httpsOnly = false
      server.close()
    }
  })

  test('GET / with httpsOnly injects data-https-only on body', async () => {
    config.httpsOnly = true
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      const body = await res.text()
      expect(body).toContain('data-https-only')
    } finally {
      config.httpsOnly = false
      server.close()
    }
  })

  test('GET / without httpsOnly allows all img-src in CSP', async () => {
    config.httpsOnly = false
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      const csp = res.headers.get('content-security-policy')
      expect(csp).toContain('img-src * data:')
    } finally {
      server.close()
    }
  })

  test('GET / without httpsOnly does not inject data-https-only', async () => {
    config.httpsOnly = false
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      const body = await res.text()
      expect(body).not.toContain('data-https-only')
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

describe('static file serving', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'pvmd-test-'))
  const pngContent = Buffer.from('fake png content')
  const svgContent = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  )

  beforeAll(() => {
    writeFileSync(join(tmpDir, 'photo.png'), pngContent)
    writeFileSync(join(tmpDir, 'icon.svg'), svgContent)
    mkdirSync(join(tmpDir, 'sub'))
    writeFileSync(join(tmpDir, 'sub', 'nested.jpg'), pngContent)
    writeFileSync(join(tmpDir, 'script.js'), 'alert(1)')
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('serves image file with correct content-type and body', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/photo.png`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('cache-control')).toBe('no-cache')
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')

      const body = Buffer.from(await res.arrayBuffer())
      expect(body).toEqual(pngContent)
    } finally {
      server.close()
    }
  })

  test('serves files from nested directories', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/sub/nested.jpg`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/jpeg')
    } finally {
      server.close()
    }
  })

  test('SVG response includes restrictive CSP header', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/icon.svg`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/svg+xml')
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; style-src 'unsafe-inline'",
      )
    } finally {
      server.close()
    }
  })

  test('returns 404 for non-image file extensions', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/script.js`)
      expect(res.status).toBe(404)
    } finally {
      server.close()
    }
  })

  test('returns 404 for non-existent image files', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/missing.png`)
      expect(res.status).toBe(404)
    } finally {
      server.close()
    }
  })

  test('returns 404 for path traversal attempts', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/../../etc/passwd.png`)
      expect(res.status).toBe(404)
    } finally {
      server.close()
    }
  })

  test('returns 404 for URL-encoded path traversal attempts', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/%2e%2e/%2e%2e/etc/passwd.png`,
      )
      expect(res.status).toBe(404)
    } finally {
      server.close()
    }
  })

  test('strips query strings before resolving files', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, tmpDir)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/photo.png?v=123`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
    } finally {
      server.close()
    }
  })

  test('without baseDir, unknown paths still return 404', async () => {
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    const port = await listenOnRandomPort(server)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/photo.png`)
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toBe('application/json')
    } finally {
      server.close()
    }
  })
})
