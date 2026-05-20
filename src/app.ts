import type { Server } from 'node:http'
import { dirname } from 'node:path'
import { config, DEFAULT_CONFIG } from './cli/config'
import {
  readMarkdownFile,
  renderBlocksHtml,
  renderMarkdownBlocks,
  validateMarkdownPath,
} from './markdown'
import { isLargerThanDefaultMaxFileSize } from './markdown/file-validation'
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

  const httpsOnly = config.httpsOnly
  const isLargeFile = isLargerThanDefaultMaxFileSize(fullPath)
  const watchEnabled = config.watch && !isLargeFile
  if (isLargeFile) {
    console.log(
      `Large markdown file detected (over ${DEFAULT_CONFIG.maxFileSize} KB). File watching is disabled for this preview, and the first browser render may take longer.`,
    )
  }
  const watcher = watchEnabled ? createWatcher(fullPath, httpsOnly) : null

  const getHTML = () => {
    const markdownContent = readMarkdownFile(fullPath)
    const blocks = renderMarkdownBlocks(markdownContent, httpsOnly)
    return prepareHTML(fullPath, renderBlocksHtml(blocks), config.theme)
  }

  const server = createServer(getHTML, watcher?.handleSSE, dirname(fullPath))
  startServer(server)

  setupShutdownHandlers(server, watcher?.cleanup ?? (() => {}))
}
