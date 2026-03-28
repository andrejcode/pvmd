import { randomBytes } from 'node:crypto'
import {
  createServer as createHttpServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { config } from './cli/config'
import { resolveStaticFile } from './utils/static-file'

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void

const APP_SCRIPT_OUTLET_MARKER = 'data-pvmd-app'
const APP_SCRIPT_OUTLET_REGEX = new RegExp(
  `(</main>[\\s\\S]*?)<script\\s+${APP_SCRIPT_OUTLET_MARKER}>`,
)
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'permissions-policy':
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), serial=(), bluetooth=()',
} as const

function generateNonce(): string {
  return randomBytes(16).toString('base64')
}

/**
 * Adds nonce only to the app script we inject after </main>.
 * We only replace the opening tag so we never match </script> inside the bundle.
 * Scripts in markdown (inside <main>) are never touched.
 */
function applyNonce(html: string, nonce: string): string {
  return html.replace(
    APP_SCRIPT_OUTLET_REGEX,
    `$1<script ${APP_SCRIPT_OUTLET_MARKER} nonce="${nonce}">`,
  )
}

function buildCSPHeader(nonce: string): string {
  const imgSrc = config.httpsOnly
    ? "img-src 'self' https: data:"
    : 'img-src * data:'

  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    imgSrc,
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'self'",
  ].join('; ')
}

function applyBodyDataAttributes(html: string): string {
  const attributes: string[] = []

  if (config.httpsOnly) {
    attributes.push('data-https-only')
  }

  if (!config.watch) {
    attributes.push('data-watch="false"')
  }

  if (attributes.length === 0) {
    return html
  }

  return html.replace(/<body\b/, `<body ${attributes.join(' ')}`)
}

function respondNotFound(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.url}`,
    }),
  )
}

function serveStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  baseDir: string,
): void {
  try {
    const [pathPart = ''] = (req.url ?? '').split('?')
    const decodedPath = decodeURIComponent(pathPart)
    const relativePath = decodedPath.replace(/^\/+/, '')
    const { data, headers } = resolveStaticFile(relativePath, baseDir)
    res.writeHead(200, headers)
    res.end(data)
  } catch {
    respondNotFound(req, res)
  }
}

export function createServer(
  getHTML: () => string,
  handleSSE?: RequestHandler,
  baseDir?: string,
): Server {
  return createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/') {
      const html = applyBodyDataAttributes(getHTML())
      const nonce = generateNonce()
      const htmlWithNonce = applyNonce(html, nonce)
      const csp = buildCSPHeader(nonce)

      res.writeHead(200, {
        'content-type': 'text/html',
        'content-security-policy': csp,
        ...SECURITY_HEADERS,
      })
      res.end(htmlWithNonce)
    } else if (req.method === 'GET' && req.url === '/events' && handleSSE) {
      handleSSE(req, res)
    } else if (req.method === 'GET' && req.url && baseDir) {
      serveStaticFile(req, res, baseDir)
    } else {
      respondNotFound(req, res)
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
    const url = `http://127.0.0.1:${config.port}/`
    console.log(`Server running at ${url}`)

    if (config.open) {
      void import('open').then(({ default: open }) => open(url))
    }
  })
}
