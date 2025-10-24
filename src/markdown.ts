import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import { marked } from 'marked'
import xss from 'xss'
import { MD_FILE_EXTENSIONS } from './constants'
import { processFileSystemError } from './utils/filesystem'

marked.use({
  async: false,
  breaks: false,
  gfm: true,
  pedantic: false,
})

export function parseMarkdown(content: string): string {
  // Sanitize parsed markdown with special zero width characters replaced
  return xss(
    marked.parse(
      // eslint-disable-next-line no-misleading-character-class
      content.replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, ''),
    ) as string,
  )
}

export function readMarkdownFile(path: string): string {
  try {
    const stats = statSync(path)
    if (stats.isDirectory()) {
      // Create a synthetic error with EISDIR code for consistent handling
      throw Object.assign(new Error(), {
        code: 'EISDIR',
      }) as NodeJS.ErrnoException
    }
  } catch (error) {
    throw new Error(processFileSystemError(error, path, 'read markdown file'))
  }

  if (!MD_FILE_EXTENSIONS.includes(extname(path).toLowerCase())) {
    throw new Error(
      `Invalid extension for path: ${path}.\nExpected extensions: ${MD_FILE_EXTENSIONS.join(', ')}`,
    )
  }

  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(processFileSystemError(error, path, 'read markdown file'))
  }
}
