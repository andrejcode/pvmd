import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type MockInstance } from 'vitest'
import { config } from '@/cli/config'
import { createServer, startServer } from '../server'

vi.mock('open', () => ({
  default: vi.fn(() => Promise.resolve()),
}))

const HTML_WITH_APP_SCRIPT = [
  '<!doctype html>',
  '<html><body>',
  '<main><p>content</p></main>',
  '<script data-pvmd-app></script>',
  '</body></html>',
].join('\n')
const HOST = '127.0.0.1'
const ROOT_PATH = '/'

function getServerUrl(port: number, path = ROOT_PATH) {
  return `http://${HOST}:${port}${path}`
}

function listenOnRandomPort(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, HOST, () => {
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

async function withTestServer(
  run: (
    request: (path: string, init?: RequestInit) => Promise<Response>,
  ) => Promise<void>,
  baseDir?: string,
) {
  const server = createServer(() => HTML_WITH_APP_SCRIPT, undefined, baseDir)
  const port = await listenOnRandomPort(server)

  try {
    await run((path, init) => fetch(getServerUrl(port, path), init))
  } finally {
    server.close()
  }
}

function getRequestHandler(server: Server) {
  const [handler] = server.listeners('request')
  return handler as (req: IncomingMessage, res: ServerResponse) => void
}

describe('createServer', () => {
  test('GET / returns 200 with security headers, CSP with nonce, and matching nonce in HTML', async () => {
    await withTestServer(async (request) => {
      const res = await request(ROOT_PATH)
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
    })
  })

  test('unhandled path returns 404 with JSON body', async () => {
    await withTestServer(async (request) => {
      const res = await request('/some-path')
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toBe('application/json')

      const json = (await res.json()) as { error: string; message: string }
      expect(json).toMatchObject({
        error: 'Not Found',
        message: 'Cannot GET /some-path',
      })
    })
  })

  test('GET / logs the render error and exits when rendering fails', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`)
      })
    const server = createServer(() => {
      throw new Error('File is too large: test.md')
    })
    const requestHandler = getRequestHandler(server)
    const req = { method: 'GET', url: '/' } as IncomingMessage
    const writeHead = vi.fn()
    const end = vi.fn()
    const res = {
      writeHead,
      end,
    } as unknown as ServerResponse

    try {
      expect(() => requestHandler(req, res)).toThrow(
        'Process exited with code 1',
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith('File is too large: test.md')
      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(writeHead).not.toHaveBeenCalled()
      expect(end).not.toHaveBeenCalled()
    } finally {
      processExitSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    }
  })

  test('GET / with httpsOnly restricts img-src to https: in CSP', async () => {
    config.httpsOnly = true

    try {
      await withTestServer(async (request) => {
        const res = await request(ROOT_PATH)
        const csp = res.headers.get('content-security-policy')
        expect(csp).toContain("img-src 'self' https: data:")
        expect(csp).not.toContain('img-src *')
      })
    } finally {
      config.httpsOnly = false
    }
  })

  test('GET / with httpsOnly injects data-https-only on body', async () => {
    config.httpsOnly = true

    try {
      await withTestServer(async (request) => {
        const res = await request(ROOT_PATH)
        const body = await res.text()
        expect(body).toContain('data-https-only')
      })
    } finally {
      config.httpsOnly = false
    }
  })

  test('GET / without httpsOnly allows all img-src in CSP', async () => {
    config.httpsOnly = false
    await withTestServer(async (request) => {
      const res = await request(ROOT_PATH)
      const csp = res.headers.get('content-security-policy')
      expect(csp).toContain('img-src * data:')
    })
  })

  test('GET / without httpsOnly does not inject data-https-only', async () => {
    config.httpsOnly = false
    await withTestServer(async (request) => {
      const res = await request(ROOT_PATH)
      const body = await res.text()
      expect(body).not.toContain('data-https-only')
    })
  })

  test('GET / with watch disabled injects data-watch="false" on body', async () => {
    config.watch = false

    try {
      await withTestServer(async (request) => {
        const res = await request(ROOT_PATH)
        const body = await res.text()
        expect(body).toContain('data-watch="false"')
      })
    } finally {
      config.watch = true
    }
  })

  test('GET / with watch enabled does not inject data-watch="false"', async () => {
    config.watch = true

    await withTestServer(async (request) => {
      const res = await request(ROOT_PATH)
      const body = await res.text()
      expect(body).not.toContain('data-watch="false"')
    })
  })

  test('POST / returns 404', async () => {
    await withTestServer(async (request) => {
      const res = await request(ROOT_PATH, {
        method: 'POST',
      })
      expect(res.status).toBe(404)

      const json = (await res.json()) as { message: string }
      expect(json.message).toBe('Cannot POST /')
    })
  })
})

describe('startServer', () => {
  let consoleSpy: MockInstance
  let savedPort: number

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    savedPort = config.port
    config.port = 0
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    config.open = false
    config.port = savedPort
  })

  test('calls open with server URL when config.open is true', async () => {
    const open = (await import('open')).default as ReturnType<typeof vi.fn>
    open.mockClear()

    config.open = true
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    startServer(server)

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
    })

    await vi.waitFor(() => {
      expect(open).toHaveBeenCalledWith(getServerUrl(config.port))
    })

    server.close()
  })

  test('does not call open when config.open is false', async () => {
    const open = (await import('open')).default as ReturnType<typeof vi.fn>
    open.mockClear()

    config.open = false
    const server = createServer(() => HTML_WITH_APP_SCRIPT)
    startServer(server)

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
    })

    expect(open).not.toHaveBeenCalled()
    server.close()
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
    await withTestServer(async (request) => {
      const res = await request('/photo.png')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('cache-control')).toBe('no-cache')
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')

      const body = Buffer.from(await res.arrayBuffer())
      expect(body).toEqual(pngContent)
    }, tmpDir)
  })

  test('serves files from nested directories', async () => {
    await withTestServer(async (request) => {
      const res = await request('/sub/nested.jpg')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/jpeg')
    }, tmpDir)
  })

  test('SVG response includes restrictive CSP header', async () => {
    await withTestServer(async (request) => {
      const res = await request('/icon.svg')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/svg+xml')
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; style-src 'unsafe-inline'",
      )
    }, tmpDir)
  })

  test('returns 404 for non-image file extensions', async () => {
    await withTestServer(async (request) => {
      const res = await request('/script.js')
      expect(res.status).toBe(404)
    }, tmpDir)
  })

  test('returns 404 for non-existent image files', async () => {
    await withTestServer(async (request) => {
      const res = await request('/missing.png')
      expect(res.status).toBe(404)
    }, tmpDir)
  })

  test('returns 404 for path traversal attempts', async () => {
    await withTestServer(async (request) => {
      const res = await request('/../../etc/passwd.png')
      expect(res.status).toBe(404)
    }, tmpDir)
  })

  test('returns 404 for URL-encoded path traversal attempts', async () => {
    await withTestServer(async (request) => {
      const res = await request('/%2e%2e/%2e%2e/etc/passwd.png')
      expect(res.status).toBe(404)
    }, tmpDir)
  })

  test('strips query strings before resolving files', async () => {
    await withTestServer(async (request) => {
      const res = await request('/photo.png?v=123')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
    }, tmpDir)
  })

  test('without baseDir, unknown paths still return 404', async () => {
    await withTestServer(async (request) => {
      const res = await request('/photo.png')
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toBe('application/json')
    })
  })
})
