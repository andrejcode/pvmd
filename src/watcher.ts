import { watch, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseMarkdown } from './markdown'
import { processFileSystemError } from './utils/file-error'

export default function createWatcher(path: string) {
  let client: ServerResponse | null = null

  function handleSSE(_req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    if (client && !client.writableEnded) {
      client.end()
    }

    client = res

    res.on('close', () => {
      if (client === res) {
        client = null
      }
    })
  }

  const watcher = watch(path, (event) => {
    if (event === 'rename') {
      console.error(`File ${path} was renamed or deleted. Exiting.`)
      watcher.close()
      process.exit(1)
    }

    if (!client || client.writableEnded) {
      return
    }

    try {
      const content = readFileSync(path, 'utf-8')
      const html = parseMarkdown(content)
      client.write(`data: ${JSON.stringify(html)}\n\n`)
    } catch (error) {
      throw new Error(processFileSystemError(error, path))
    }
  })

  return {
    handleSSE,
    cleanup: () => {
      watcher.close()
      if (client && !client.writableEnded) {
        client.end()
      }
    },
  }
}
