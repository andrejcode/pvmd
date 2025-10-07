#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'

const hostname = '127.0.0.1'
const port = 3000

const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
  const args = process.argv.slice(2)
  console.log('Arguments:', args)

  try {
    const html = readFileSync(
      new URL('./client/index.html', import.meta.url),
      'utf8',
    )

    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(html)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
})

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`)
  console.log(`Started from: ${process.cwd()}`)
})
