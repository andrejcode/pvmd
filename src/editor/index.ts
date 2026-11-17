import type { Server } from 'node:http'
import { dirname, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { config } from '../cli/config'
import { renderBlocksHtml, renderMarkdownBlocks } from '../markdown'
import { createServer, startServer } from '../server'
import { prepareHTML } from '../template'
import { EDITOR_PROTOCOL_VERSION, readEditorInput } from './input'
import { createLivePreview } from '../watcher/live-preview'

export function runEditor(
  input: Readable = process.stdin,
  send: (message: object) => void = (message) => {
    process.stdout.write(`${JSON.stringify(message)}\n`)
  },
) {
  let blocks = renderMarkdownBlocks('', config.httpsOnly)
  let revision = 0
  let server: Server | null = null
  let closed = false
  const preview = createLivePreview(() => blocks)

  const reportError = (error: unknown) => {
    send({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const detach = readEditorInput(
    input,
    (message) => {
      if (closed) return
      if (message.type === 'init' && server)
        throw new Error('Editor session is already initialized')
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
        preview.update(blocks)
        startServer(server, (url) => {
          if (!closed)
            send({
              type: 'ready',
              protocol: EDITOR_PROTOCOL_VERSION,
              url,
              revision: message.revision,
            })
        })
      } else {
        blocks = nextBlocks
        revision = message.revision
        preview.update(blocks)
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
