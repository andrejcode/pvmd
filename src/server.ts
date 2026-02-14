import { randomBytes } from 'node:crypto'
import {
  createServer as createHttpServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { config } from './cli/config'

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void

export function generateNonce(): string {
  return randomBytes(16).toString('base64')
}

const SCRIPT_OUTLET_MARKER = 'data-pvmd-app'

/**
 * Adds nonce only to the app script we inject after </main>.
 * We only replace the opening tag so we never match </script> inside the bundle.
 * Scripts in markdown (inside <main>) are never touched.
 */
export function applyNonce(html: string, nonce: string): string {
  return html.replace(
    new RegExp(`(</main>\\s*)<script\\s+${SCRIPT_OUTLET_MARKER}>`),
    `$1<script ${SCRIPT_OUTLET_MARKER} nonce="${nonce}">`,
  )
}

export function buildCSPHeader(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    'img-src * data: blob:',
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
  ].join('; ')
}

export function createServer(
  getHTML: () => string,
  handleSSE?: RequestHandler,
): Server {
  return createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/') {
      const html = getHTML()
      const nonce = generateNonce()
      const htmlWithNonce = applyNonce(html, nonce)
      const csp = buildCSPHeader(nonce)

      res.writeHead(200, {
        'content-type': 'text/html',
        'content-security-policy': csp,
      })
      res.end(htmlWithNonce)
    } else if (req.method === 'GET' && req.url === '/events' && handleSSE) {
      handleSSE(req, res)
    } else {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          error: 'Not Found',
          message: `Cannot ${req.method} ${req.url}`,
        }),
      )
    }
  })
}

export function startServer(server: Server) {
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${config.port} is already in use. Please use a different port.`,
      )
      process.exit(1)
    }
    throw error
  })

  server.listen(config.port, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${config.port}/`)
  })
}
