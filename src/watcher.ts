import { watch, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseMarkdown } from './markdown'
import { processFileSystemError } from './utils/file-error'

export default function createWatcher(path: string) {
  const clients = new Set<ServerResponse>()

  function handleSSE(_req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    clients.add(res)

    res.on('close', () => {
      clients.delete(res)
    })
  }

  const watcher = watch(path, (event) => {
    if (event === 'rename') {
      console.error(`File ${path} was renamed or deleted. Exiting.`)
      watcher.close()
      process.exit(1)
    }

    if (clients.size === 0) {
      return
    }

    try {
      const content = readFileSync(path, 'utf-8')
      const html = parseMarkdown(content)
      const data = `data: ${JSON.stringify(html)}\n\n`
      for (const client of clients) {
        if (!client.writableEnded) {
          client.write(data)
        }
      }
    } catch (error) {
      throw new Error(processFileSystemError(error, path))
    }
  })

  return {
    handleSSE,
    cleanup: () => {
      watcher.close()
      for (const client of clients) {
        if (!client.writableEnded) {
          client.end()
        }
      }
      clients.clear()
    },
  }
}
