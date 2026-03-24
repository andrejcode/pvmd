import { watch, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { renderMarkdownDocument } from '@/markdown'
import type { LiveUpdateDocument } from '@/shared/live-update'
import { processFileSystemError } from '@/utils/file-error'
import { createLiveUpdateMessage } from './patch-diff'

export default function createWatcher(path: string) {
  const debounceMs = 200
  const clients = new Set<ServerResponse>()
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let previousDocument: LiveUpdateDocument | null = null

  function cancelScheduledReload() {
    if (!reloadTimer) {
      return
    }

    clearTimeout(reloadTimer)
    reloadTimer = null
  }

  function broadcastUpdate() {
    if (clients.size === 0) {
      return
    }

    try {
      const content = readFileSync(path, 'utf-8')
      const nextDocument = renderMarkdownDocument(content)
      const message = createLiveUpdateMessage(previousDocument, nextDocument)

      previousDocument = nextDocument

      if (!message) {
        return
      }

      const data = `data: ${JSON.stringify(message)}\n\n`

      for (const client of clients) {
        if (!client.writableEnded) {
          client.write(data)
        }
      }
    } catch (error) {
      throw new Error(processFileSystemError(error, path))
    }
  }

  function scheduleReload() {
    if (clients.size === 0) {
      return
    }

    cancelScheduledReload()
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      broadcastUpdate()
    }, debounceMs)
  }

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
      cancelScheduledReload()
      watcher.close()
      process.exit(1)
    }

    scheduleReload()
  })

  return {
    handleSSE,
    cleanup: () => {
      cancelScheduledReload()
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
