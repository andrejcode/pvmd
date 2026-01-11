import {
  createServer as createHttpServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { config } from './cli/config'

export function createServer(html: string): Server {
  return createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(html)
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
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${config.port}/`)
  })
}
