import { randomBytes } from 'node:crypto'
import {
  createServer as createHttpServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { config } from './cli/config'
import { exitWithError } from './utils/fatal-error'
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

function getErrorPort(error: NodeJS.ErrnoException): number | null {
  if (!('port' in error)) {
    return null
  }

  const { port } = error as NodeJS.ErrnoException & { port?: unknown }
  return typeof port === 'number' ? port : null
}

export async function openServerUrl(url: string): Promise<void> {
  try {
    await import('open').then(({ default: open }) => open(url))
  } catch {
    console.warn(
      `Failed to open the browser automatically. Open this URL manually: ${url}`,
    )
  }
}

export function createServer(
  getHTML: () => string,
  handleSSE?: RequestHandler,
  baseDir?: string,
): Server {
  return createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/') {
      try {
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
      } catch (error) {
        exitWithError(error)
      }
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
      exitWithError(
        `Port ${config.port} is already in use. Please use a different port.`,
      )
    }

    if (error.code === 'EACCES') {
      const port = getErrorPort(error) ?? config.port
      const lowPortHint =
        port < 1024
          ? 'Ports below 1024 often require elevated permissions and may be reserved by the system or browser. Try a higher port such as 8765.'
          : 'Please choose a different port.'

      exitWithError(
        `Permission denied while binding to port ${port} on 127.0.0.1. ${lowPortHint}`,
      )
    }

    throw error
  })

  server.listen(config.port, '127.0.0.1', () => {
    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Unable to determine server address after startup')
    }

    const url = `http://127.0.0.1:${address.port}/`
    console.log(`Server running at ${url}`)

    if (config.open) {
      void openServerUrl(url)
    }
  })
}
