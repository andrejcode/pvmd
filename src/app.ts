import type { Server } from 'node:http'
import { dirname } from 'node:path'
import { config } from './cli/config'
import {
  readMarkdownFile,
  renderMarkdownDocument,
  validateMarkdownPath,
} from './markdown'
import { createServer, startServer } from './server'
import { prepareHTML } from './template'
import { resolvePath } from './utils/path-validation'
import createWatcher from './watcher'

function setupShutdownHandlers(server: Server, cleanup: () => void) {
  const shutdown = () => {
    cleanup()
    server.close(() => {
      process.exit(0)
    })

    setTimeout(() => {
      process.exit(0)
    }, 5000)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

export function run(userPath: string) {
  const fullPath = resolvePath(userPath)
  validateMarkdownPath(fullPath)

  const watcher = config.watch ? createWatcher(fullPath) : null

  const getHTML = () => {
    const markdownContent = readMarkdownFile(fullPath)
    const renderedMarkdown = renderMarkdownDocument(markdownContent)
    return prepareHTML(fullPath, renderedMarkdown.html, config.theme)
  }

  const server = createServer(getHTML, watcher?.handleSSE, dirname(fullPath))
  startServer(server)

  setupShutdownHandlers(server, watcher?.cleanup ?? (() => {}))
}
