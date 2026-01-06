import { readFileSync } from 'node:fs'
import { marked } from 'marked'
import xss from 'xss'
import {
  ValidationError,
  validateFile,
  validateMarkdownExtension,
} from './file-validation'
import { processFileSystemError } from '../utils/file-error'

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
    validateFile(path)
    validateMarkdownExtension(path)

    return readFileSync(path, 'utf8')
  } catch (error) {
    // ValidationError is thrown when the file is not a markdown file
    // It has custom error messages, so we can throw it directly
    if (error instanceof ValidationError) {
      throw error
    }

    throw new Error(processFileSystemError(error, path))
  }
}
