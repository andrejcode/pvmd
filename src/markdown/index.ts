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
import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateBlock,
} from '@/shared/live-update'
import { processFileSystemError } from '@/utils/file-error'
import { validateFile, validateMarkdownExtension } from './file-validation'
import { sanitizeHTML } from './sanitize-html'

const markedEmojiOptions = {
  emojis: nameToEmoji,
  renderer: (token: { emoji: string }) => `<g-emoji>${token.emoji}</g-emoji>`,
}

const starryNight = await createStarryNight(common)

const HIGHLIGHT_CACHE_MAX_SIZE = 256
const BLOCK_HTML_CACHE_MAX_SIZE = 512

class LruCache<K, V> {
  private readonly map = new Map<K, V>()

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxSize) {
      this.map.delete(this.map.keys().next().value as K)
    }
    this.map.set(key, value)
  }

  clear(): void {
    this.map.clear()
  }
}

const highlightCache = new LruCache<string, string>(HIGHLIGHT_CACHE_MAX_SIZE)
const blockHtmlCache = new LruCache<string, string>(BLOCK_HTML_CACHE_MAX_SIZE)

export function clearRenderCaches(): void {
  highlightCache.clear()
  blockHtmlCache.clear()
}

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
      return highlightCode(code, lang)
    },
  }),
  gfmHeadingId(),
)

type MarkdownToken = ReturnType<typeof marked.lexer>[number]

export function renderMarkdownBlocks(content: string): LiveUpdateBlock[] {
  const normalizedContent = preprocessMarkdownContent(
    normalizeMarkdownContent(content),
  )
  const tokens = walkMarkdownTokens(
    processMarkdownTokens(marked.lexer(normalizedContent)),
  )
  const blockOccurrences = new Map<string, number>()

  const blocks: LiveUpdateBlock[] = []

  for (const token of tokens) {
    const html = renderTokenHtml(token)
    if (!html.trim()) {
      continue
    }

    const key = getBlockKey(token, html)
    const occurrence = (blockOccurrences.get(key) ?? 0) + 1
    blockOccurrences.set(key, occurrence)

    const id = createBlockId(token.type, key, occurrence)

    blocks.push({
      id,
      html,
    })
  }

  return blocks
}

export function renderBlocksHtml(blocks: readonly LiveUpdateBlock[]): string {
  return blocks.map((block) => wrapBlock(block.id, block.html)).join('')
}

function readFile(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(processFileSystemError(error, path))
  }
}

export function validateMarkdownPath(path: string): void {
  validateFile(path)
  validateMarkdownExtension(path)
}

export function readMarkdownFile(path: string): string {
  validateMarkdownPath(path)

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

function walkMarkdownTokens(tokens: MarkdownToken[]): MarkdownToken[] {
  if (marked.defaults.walkTokens) {
    void marked.walkTokens(tokens, marked.defaults.walkTokens)
  }

  return tokens
}

function renderTokenHtml(token: MarkdownToken): string {
  const key = JSON.stringify(token)
  const cached = blockHtmlCache.get(key)
  if (cached !== undefined) return cached
  const result = sanitizeHTML(marked.parser([structuredClone(token)]))
  blockHtmlCache.set(key, result)
  return result
}

function highlightCode(code: string, lang: string): string {
  const key = `${lang}\x00${code}`
  const cached = highlightCache.get(key)
  if (cached !== undefined) return cached
  const scope = starryNight.flagToScope(lang)
  const result = scope ? toHtml(starryNight.highlight(code, scope)) : code
  highlightCache.set(key, result)
  return result
}

function getBlockKey(token: MarkdownToken, html: string): string {
  const raw = 'raw' in token && typeof token.raw === 'string' ? token.raw : ''
  const content = html || raw
  return `${token.type}:${content}`
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
