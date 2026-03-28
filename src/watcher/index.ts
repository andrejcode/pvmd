import { watch } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readMarkdownFile, renderMarkdownDocument } from '@/markdown'
import type { LiveUpdateDocument } from '@/shared/live-update'
import { exitWithError } from '@/utils/fatal-error'
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

  function exitOnWatcherError(error: unknown): never {
    cancelScheduledReload()
    watcher.close()

    for (const client of clients) {
      if (!client.writableEnded) {
        client.end()
      }
    }

    exitWithError(error)
  }

  function broadcastUpdate() {
    if (clients.size === 0) {
      return
    }

    try {
      const content = readMarkdownFile(path)
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
      exitOnWatcherError(error)
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
      cancelScheduledReload()
      watcher.close()
      exitWithError(`File ${path} was renamed or deleted. Exiting.`)
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
