import { readFileSync } from 'node:fs'
import { marked } from 'marked'
import markedAlert from 'marked-alert'
import markedFootnote from 'marked-footnote'
import markedKatex from 'marked-katex-extension'
import { validateFile, validateMarkdownExtension } from './file-validation'
import { processFileSystemError } from '../utils/file-error'

marked.use(
  {
    async: false,
    breaks: true,
    gfm: true,
    pedantic: false,
  },
  markedAlert(),
  markedFootnote(),
  markedKatex({ throwOnError: false }),
)

export function parseMarkdown(content: string): string {
  return marked.parse(
    // eslint-disable-next-line no-misleading-character-class
    content.replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, ''),
  ) as string
}

export function readFile(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(processFileSystemError(error, path))
  }
}

export function readMarkdownFile(path: string): string {
  validateFile(path)
  validateMarkdownExtension(path)

  return readFile(path)
}
