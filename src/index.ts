#!/usr/bin/env node

import { parseArguments } from './cli'
import { parseMarkdown, readMarkdownFile } from './markdown'
import { createServer, startServer } from './server'
import { readHTMLTemplate, injectMarkdown } from './template'
import { resolvePath } from './utils/validation'
import createWatcher from './watcher'

try {
  const args = process.argv.slice(2)
  const { userPath } = parseArguments(args)

  const fullPath = resolvePath(userPath)

  const markdownContent = readMarkdownFile(fullPath)
  const parsedMarkdown = parseMarkdown(markdownContent)

  const htmlTemplate = readHTMLTemplate()
  const preparedHTML = injectMarkdown(htmlTemplate, parsedMarkdown)

  const server = createServer(preparedHTML)
  startServer(server)

  createWatcher(server, fullPath)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}
