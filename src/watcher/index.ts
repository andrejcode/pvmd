import { watch, type FSWatcher } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  readMarkdownFile,
  renderMarkdownDocument,
  validateMarkdownPath,
} from '@/markdown'
import type { LiveUpdateDocument } from '@/shared/live-update'
import { exitWithError } from '@/utils/fatal-error'
import { createLiveUpdateMessage } from './patch-diff'

export default function createWatcher(path: string) {
  const debounceMs = 200
  const renameRetryDelayMs = 50
  const renameRetryLimit = 10
  const clients = new Set<ServerResponse>()
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let renameRetryTimer: ReturnType<typeof setTimeout> | null = null
  let previousDocument: LiveUpdateDocument | null = null
  let watcher: FSWatcher | null = null
  let isClosed = false

  function cancelScheduledReload() {
    if (!reloadTimer) {
      return
    }

    clearTimeout(reloadTimer)
    reloadTimer = null
  }

  function cancelRenameRetry() {
    if (!renameRetryTimer) {
      return
    }

    clearTimeout(renameRetryTimer)
    renameRetryTimer = null
  }

  function closeWatcher() {
    watcher?.close()
    watcher = null
  }

  function closeClients() {
    for (const client of clients) {
      if (!client.writableEnded) {
        client.end()
      }
    }
  }

  function exitOnWatcherError(error: unknown): never {
    cancelScheduledReload()
    cancelRenameRetry()
    isClosed = true
    closeWatcher()
    closeClients()

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

  function attachWatcher() {
    if (isClosed) {
      return
    }

    watcher = watch(path, handleWatchEvent)
  }

  function recoverWatcher(attempt: number) {
    if (isClosed) {
      return
    }

    try {
      validateMarkdownPath(path)
      attachWatcher()
      scheduleReload()
    } catch (error) {
      if (attempt >= renameRetryLimit - 1) {
        exitOnWatcherError(error)
      }

      renameRetryTimer = setTimeout(() => {
        renameRetryTimer = null
        recoverWatcher(attempt + 1)
      }, renameRetryDelayMs)
    }
  }

  function handleWatchEvent(event: 'rename' | 'change') {
    if (event === 'rename') {
      cancelScheduledReload()
      closeWatcher()
      recoverWatcher(0)
      return
    }

    scheduleReload()
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

  attachWatcher()

  return {
    handleSSE,
    cleanup: () => {
      cancelScheduledReload()
      cancelRenameRetry()
      isClosed = true
      closeWatcher()
      closeClients()
      clients.clear()
    },
  }
}
