import type { Server } from 'node:http'
import { dirname, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { config } from '../cli/config'
import { renderBlocksHtml, renderMarkdownBlocks } from '../markdown'
import { createServer, startServer } from '../server'
import type { ScrollUpdateMessage } from '../shared/live-update'
import { prepareHTML } from '../template'
import { NVIM_PROTOCOL_VERSION, readNeovimInput } from './input'
import { createLivePreview } from '../watcher/live-preview'

export function runNeovim(
  input: Readable = process.stdin,
  send: (message: object) => void = (message) => {
    process.stdout.write(`${JSON.stringify(message)}\n`)
  },
) {
  let blocks = renderMarkdownBlocks('', config.httpsOnly)
  let revision = 0
  let line: number | undefined
  let server: Server | null = null
  let closed = false
  const preview = createLivePreview(() => blocks, getScrollSnapshot)

  function getScrollSnapshot(): ScrollUpdateMessage | null {
    if (line === undefined) return null
    const mapped = blocks.filter((block) => block.sourceStartLine !== undefined)
    const block = mapped.find(
      (_, index) => line! < (mapped[index + 1]?.sourceStartLine ?? Infinity),
    )
    if (!block) return null
    const start = block.sourceStartLine!
    const end = block.sourceEndLine!
    return {
      kind: 'scroll',
      blockId: block.id,
      progress: Math.max(0, Math.min((line - start) / (end - start + 1), 1)),
    }
  }

  function updateScroll() {
    const scroll = getScrollSnapshot()
    if (scroll) preview.broadcast(scroll)
  }

  const reportError = (error: unknown) => {
    send({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const detach = readNeovimInput(
    input,
    (message) => {
      if (closed) return
      if (message.type === 'scroll') {
        if (!server) throw new Error('Send init before scrolling the document')
        if (message.revision !== revision) return
        line = message.line
        updateScroll()
        return
      }
      if (message.type === 'init' && server)
        throw new Error('Neovim session is already initialized')
      if (message.type === 'update' && !server)
        throw new Error('Send init before updating the document')
      if (message.revision <= revision) {
        send({ type: 'applied', revision: message.revision, stale: true })
        return
      }

      const nextBlocks = renderMarkdownBlocks(message.content, config.httpsOnly)
      if (message.type === 'init') {
        const baseDir = resolve(
          message.baseDir ||
            (message.path ? dirname(message.path) : process.cwd()),
        )
        const path = message.path
          ? resolve(message.path)
          : resolve(baseDir, 'untitled.md')
        server = createServer(
          () => prepareHTML(path, renderBlocksHtml(blocks), config.theme),
          preview.handleSSE,
          baseDir,
        )
        blocks = nextBlocks
        revision = message.revision
        line = message.line
        preview.update(blocks)
        startServer(server, (url) => {
          if (!closed)
            send({
              type: 'ready',
              protocol: NVIM_PROTOCOL_VERSION,
              url,
              revision: message.revision,
              capabilities: ['scroll'],
            })
        })
      } else {
        blocks = nextBlocks
        revision = message.revision
        line = message.line ?? line
        preview.update(blocks)
        updateScroll()
        send({ type: 'applied', revision })
      }
    },
    reportError,
    cleanup,
  )

  function cleanup() {
    if (closed) return
    closed = true
    detach()
    input.pause()
    preview.cleanup()
    server?.close()
    server?.closeAllConnections()
    process.off('SIGINT', cleanup)
    process.off('SIGTERM', cleanup)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  return cleanup
}
