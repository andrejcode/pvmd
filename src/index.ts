#!/usr/bin/env node

import { parseArguments } from './cli'
import { parseMarkdown, readMarkdownFile } from './markdown'
import { createServer, startServer } from './server'
import { prepareHTML } from './template'
import { resolvePath } from './utils/validation'
import createWatcher from './watcher'

try {
  const args = process.argv.slice(2)
  const { userPath } = parseArguments(args)

  const fullPath = resolvePath(userPath)

  const markdownContent = readMarkdownFile(fullPath)
  const parsedMarkdown = parseMarkdown(markdownContent)

  const preparedHTML = prepareHTML(fullPath, parsedMarkdown)

  const server = createServer(preparedHTML)
  startServer(server)

  const cleanup = createWatcher(server, fullPath)

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
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}
