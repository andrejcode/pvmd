import { watch, readFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { parseMarkdown } from './markdown'
import { processFileSystemError } from './utils/file-error'

export default function createWatcher(server: Server, path: string) {
  const wss = new WebSocketServer({ server })

  let client: WebSocket | null = null

  wss.on('connection', (ws: WebSocket) => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close()
    }

    client = ws

    ws.on('close', () => {
      if (client === ws) {
        client = null
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
      if (client === ws) {
        client = null
      }
    })
  })

  const watcher = watch(path, (event) => {
    if (event === 'rename') {
      console.error(`File ${path} was renamed or deleted. Exiting.`)
      watcher.close()
      wss.close()
      process.exit(1)
    }

    if (!client || client.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      const content = readFileSync(path, 'utf-8')
      const html = parseMarkdown(content)
      client.send(html)
    } catch (error) {
      throw new Error(processFileSystemError(error, path))
    }
  })

  return () => {
    watcher.close()
    wss.close()
  }
}
