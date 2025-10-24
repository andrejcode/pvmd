import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { marked } from 'marked'
import xss from 'xss'
import { MD_FILE_EXTENSIONS } from './constants'

marked.use({
  async: false,
  breaks: false,
  gfm: true,
  pedantic: false,
})

export function readMarkdownFile(path: string): string {
  const extension = extname(path).toLowerCase()
  if (!MD_FILE_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Invalid extension for path: ${path}.\nExpected extensions: ${MD_FILE_EXTENSIONS.join(', ')}`,
    )
  }

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
  return xss(
    marked.parse(
      // eslint-disable-next-line no-misleading-character-class
      content.replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, ''),
    ) as string,
  )
}
