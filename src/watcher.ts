import { watch, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { LiveUpdateMessage, LiveUpdateOperation } from './live-update'
import { renderMarkdownDocument, type MarkdownDocument } from './markdown'
import { processFileSystemError } from './utils/file-error'

export default function createWatcher(path: string) {
  const debounceMs = 200
  const clients = new Set<ServerResponse>()
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let previousDocument: MarkdownDocument | null = null

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

function createLiveUpdateMessage(
  previousDocument: MarkdownDocument | null,
  nextDocument: MarkdownDocument,
): LiveUpdateMessage | null {
  if (!previousDocument) {
    return {
      kind: 'full',
      html: nextDocument.html,
    }
  }

  const ops = diffDocuments(previousDocument, nextDocument)
  if (ops.length === 0) {
    return null
  }

  return {
    kind: 'patch',
    ops,
  }
}

function diffDocuments(
  previousDocument: MarkdownDocument,
  nextDocument: MarkdownDocument,
): LiveUpdateOperation[] {
  const previousIds = previousDocument.blocks.map((block) => block.id)
  const nextIds = nextDocument.blocks.map((block) => block.id)
  const matches = findLongestCommonSubsequence(previousIds, nextIds)
  const ops: LiveUpdateOperation[] = []

  let previousIndex = 0
  let nextIndex = 0

  for (const [matchedPreviousIndex, matchedNextIndex] of [
    ...matches,
    [previousIds.length, nextIds.length] as const,
  ]) {
    while (previousIndex < matchedPreviousIndex) {
      ops.push({
        type: 'remove',
        blockId: previousIds[previousIndex]!,
      })
      previousIndex += 1
    }

    while (nextIndex < matchedNextIndex) {
      const beforeBlockId = nextIds[matchedNextIndex]

      ops.push({
        type: 'insert',
        html: wrapBlockForInsertion(nextDocument.blocks[nextIndex]!),
        ...(beforeBlockId ? { beforeBlockId } : {}),
      })
      nextIndex += 1
    }

    previousIndex += 1
    nextIndex += 1
  }

  return ops
}

function findLongestCommonSubsequence(
  previousIds: string[],
  nextIds: string[],
): Array<readonly [number, number]> {
  const matrix = Array.from({ length: previousIds.length + 1 }, () =>
    Array<number>(nextIds.length + 1).fill(0),
  )

  for (
    let previousIndex = previousIds.length - 1;
    previousIndex >= 0;
    previousIndex -= 1
  ) {
    for (let nextIndex = nextIds.length - 1; nextIndex >= 0; nextIndex -= 1) {
      if (previousIds[previousIndex] === nextIds[nextIndex]) {
        matrix[previousIndex]![nextIndex] =
          matrix[previousIndex + 1]![nextIndex + 1]! + 1
      } else {
        matrix[previousIndex]![nextIndex] = Math.max(
          matrix[previousIndex + 1]![nextIndex]!,
          matrix[previousIndex]![nextIndex + 1]!,
        )
      }
    }
  }

  const matches: Array<readonly [number, number]> = []
  let previousIndex = 0
  let nextIndex = 0

  while (previousIndex < previousIds.length && nextIndex < nextIds.length) {
    if (previousIds[previousIndex] === nextIds[nextIndex]) {
      matches.push([previousIndex, nextIndex])
      previousIndex += 1
      nextIndex += 1
      continue
    }

    if (
      matrix[previousIndex + 1]![nextIndex]! >=
      matrix[previousIndex]![nextIndex + 1]!
    ) {
      previousIndex += 1
    } else {
      nextIndex += 1
    }
  }

  return matches
}

function wrapBlockForInsertion(
  block: MarkdownDocument['blocks'][number],
): string {
  return `<div data-pvmd-block-id="${block.id}">${block.html}</div>`
}
