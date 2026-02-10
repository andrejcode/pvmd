import {
  createServer as createHttpServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { config } from './cli/config'

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void

export function createServer(html: string, handleSSE?: RequestHandler): Server {
  return createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(html)
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
