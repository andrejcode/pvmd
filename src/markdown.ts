import { readFileSync } from 'node:fs'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export function readMarkdownFile(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    let errorMessage = `Unable to read markdown file: ${path}`

    if (error instanceof Error && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException
      switch (nodeError.code) {
        case 'ENOENT':
          errorMessage = `File not found: ${path}`
          break
        case 'EACCES':
          errorMessage = `Permission denied: ${path}`
          break
        case 'EISDIR':
          errorMessage = `Path is a directory: ${path}`
          break
      }
    }

    throw new Error(errorMessage)
  }
}

export function parseMarkdown(content: string): string {
  // Sanitize parsed markdown with special zero width characters replaced
  return sanitizeHtml(
    marked.parse(
      // eslint-disable-next-line no-misleading-character-class
      content.replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, ''),
      { async: false },
    ),
  )
}
