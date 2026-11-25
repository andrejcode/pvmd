import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  LiveUpdateBlock,
  LiveUpdateMessage,
  ScrollUpdateMessage,
} from '@/shared/live-update'
import { createLiveUpdateMessage } from './patch-diff'

export function createLivePreview(
  getSnapshot?: () => LiveUpdateBlock[],
  getScrollSnapshot?: () => ScrollUpdateMessage | null,
) {
  const clients = new Set<ServerResponse>()
  let previousBlocks: LiveUpdateBlock[] | null = null

  function update(nextBlocks: LiveUpdateBlock[]) {
    const message = createLiveUpdateMessage(previousBlocks, nextBlocks)
    previousBlocks = nextBlocks
    if (!message) return

    broadcast(message)
  }

  function broadcast(message: LiveUpdateMessage) {
    const data = `data: ${JSON.stringify(message)}\n\n`
    for (const client of clients) {
      if (!client.writableEnded) client.write(data)
    }
  }

  function handleSSE(_req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    if (getSnapshot) {
      const blocks = getSnapshot()
      const message = createLiveUpdateMessage(null, blocks)
      previousBlocks = blocks
      res.write(`data: ${JSON.stringify(message)}\n\n`)
    }
    const scroll = getScrollSnapshot?.()
    if (scroll) res.write(`data: ${JSON.stringify(scroll)}\n\n`)
    clients.add(res)
    res.on('close', () => clients.delete(res))
  }

  return {
    handleSSE,
    update,
    broadcast,
    hasClients: () => clients.size > 0,
    cleanup: () => {
      for (const client of clients) {
        if (!client.writableEnded) client.end()
      }
      clients.clear()
    },
  }
}
