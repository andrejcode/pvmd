import type { Server } from 'node:http'
import { parseMarkdown, readMarkdownFile } from './markdown'
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

  const markdownContent = readMarkdownFile(fullPath)
  const parsedMarkdown = parseMarkdown(markdownContent)

  const preparedHTML = prepareHTML(fullPath, parsedMarkdown)

  const server = createServer(preparedHTML)
  startServer(server)

  const cleanup = createWatcher(server, fullPath)

  setupShutdownHandlers(server, cleanup)
}
