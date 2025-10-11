#!/usr/bin/env node

import { parseArguments } from './cli'
import { parseMarkdown, readMarkdownFile } from './markdown'
import { createServer, startServer } from './server'
import { readHTMLTemplate, injectMarkdown } from './template'
import { exitWithError } from './utils/process'

try {
  const args = process.argv.slice(2)
  const { filePath } = parseArguments(args)

  const markdownContent = readMarkdownFile(filePath)
  const parsedMarkdown = parseMarkdown(markdownContent)

  const htmlTemplate = readHTMLTemplate()
  const preparedHTML = injectMarkdown(htmlTemplate, parsedMarkdown)

  const server = createServer(preparedHTML)
  startServer(server)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  exitWithError(message)
}
