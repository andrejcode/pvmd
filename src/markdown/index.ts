import { readFileSync } from 'node:fs'
import { common, createStarryNight } from '@wooorm/starry-night'
import { nameToEmoji } from 'gemoji'
import { toHtml } from 'hast-util-to-html'
import { marked } from 'marked'
import markedAlert from 'marked-alert'
import { markedEmoji } from 'marked-emoji'
import markedFootnote from 'marked-footnote'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedHighlight } from 'marked-highlight'
import markedKatex from 'marked-katex-extension'
import { processFileSystemError } from '@/utils/file-error'
import { validateFile, validateMarkdownExtension } from './file-validation'

const markedEmojiOptions = {
  emojis: nameToEmoji,
  renderer: (token: { emoji: string }) => `<g-emoji>${token.emoji}</g-emoji>`,
}

const starryNight = await createStarryNight(common)

marked.use(
  {
    async: false,
    breaks: false,
    gfm: true,
    pedantic: false,
  },
  markedAlert(),
  markedFootnote(),
  markedKatex({ throwOnError: false }),
  markedEmoji(markedEmojiOptions),
  markedHighlight({
    highlight(code, lang) {
      const scope = starryNight.flagToScope(lang)
      return scope ? toHtml(starryNight.highlight(code, scope)) : code
    },
  }),
  gfmHeadingId(),
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
