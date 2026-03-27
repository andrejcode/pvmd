import { readFileSync } from 'node:fs'
import { common, createStarryNight } from '@wooorm/starry-night'
import { nameToEmoji } from 'gemoji'
import { toHtml } from 'hast-util-to-html'
import { marked } from 'marked'
import markedAlert from 'marked-alert'
import { markedEmoji } from 'marked-emoji'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedHighlight } from 'marked-highlight'
import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateBlock,
  type LiveUpdateDocument,
} from '@/shared/live-update'
import { processFileSystemError } from '@/utils/file-error'
import { validateFile, validateMarkdownExtension } from './file-validation'
import { sanitizeHTML } from './sanitize-html'

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
  markedEmoji(markedEmojiOptions),
  markedHighlight({
    highlight(code, lang) {
      return highlightCode(code, lang)
    },
  }),
  gfmHeadingId(),
)

type MarkdownToken = ReturnType<typeof marked.lexer>[number]

export function parseMarkdown(content: string): string {
  const html = marked.parse(normalizeMarkdownContent(content)) as string

  return sanitizeHTML(html)
}

export function renderMarkdownDocument(content: string): LiveUpdateDocument {
  const normalizedContent = preprocessMarkdownContent(
    normalizeMarkdownContent(content),
  )
  const tokens = processMarkdownTokens(marked.lexer(normalizedContent))
  const blockOccurrences = new Map<string, number>()

  const blocks: LiveUpdateBlock[] = tokens.map((token) => {
    const key = getBlockKey(token)
    const occurrence = (blockOccurrences.get(key) ?? 0) + 1
    blockOccurrences.set(key, occurrence)

    const id = createBlockId(token.type, key, occurrence)
    const html = renderTokenHtml(token)

    return {
      id,
      html,
    }
  })

  return {
    blocks,
    html: blocks.map((block) => wrapBlock(block.id, block.html)).join(''),
  }
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

function normalizeMarkdownContent(content: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return content.replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, '')
}

function preprocessMarkdownContent(content: string): string {
  return marked.defaults.hooks?.preprocess?.call(marked, content) ?? content
}

function processMarkdownTokens(tokens: MarkdownToken[]): MarkdownToken[] {
  return marked.defaults.hooks?.processAllTokens?.call(marked, tokens) ?? tokens
}

function renderTokenHtml(token: MarkdownToken): string {
  const tokens = [structuredClone(token)] as MarkdownToken[]

  if (marked.defaults.walkTokens) {
    void marked.walkTokens(tokens, marked.defaults.walkTokens)
  }

  return sanitizeHTML(marked.parser(tokens))
}

function highlightCode(code: string, lang: string): string {
  const scope = starryNight.flagToScope(lang)
  return scope ? toHtml(starryNight.highlight(code, scope)) : code
}

function getBlockKey(token: MarkdownToken): string {
  const raw = 'raw' in token && typeof token.raw === 'string' ? token.raw : ''
  return `${token.type}:${raw}`
}

function createBlockId(type: string, key: string, occurrence: number): string {
  return `pvmd-${type}-${hashString(key)}-${occurrence}`
}

function wrapBlock(id: string, html: string): string {
  return `<div ${LIVE_BLOCK_ATTRIBUTE}="${id}">${html}</div>`
}

function hashString(value: string): string {
  let hash = 5381

  for (const character of value) {
    hash = (hash * 33) ^ character.charCodeAt(0)
  }

  return (hash >>> 0).toString(36)
}
