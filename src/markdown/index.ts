import { readFileSync } from 'node:fs'
import { common, createStarryNight } from '@wooorm/starry-night'
import { toHtml } from 'hast-util-to-html'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateBlock,
  type LiveUpdateDocument,
} from '@/shared/live-update'
import { processFileSystemError } from '@/utils/file-error'
import { validateFile, validateMarkdownExtension } from './file-validation'
import { sanitizeHTML } from './sanitize-html'

const starryNight = await createStarryNight(common)

marked.use(
  {
    async: false,
    breaks: false,
    gfm: true,
    pedantic: false,
  },
  markedHighlight({
    highlight(code, lang) {
      return highlightCode(code, lang)
    },
  }),
)

type MarkdownToken = ReturnType<typeof marked.lexer>[number]
type HighlightableToken = {
  type?: unknown
  text?: unknown
  lang?: unknown
  escaped?: unknown
  [key: string]: unknown
}

export function parseMarkdown(content: string): string {
  const html = marked.parse(normalizeMarkdownContent(content)) as string

  return sanitizeHTML(html)
}

export function renderMarkdownDocument(content: string): LiveUpdateDocument {
  const tokens = marked.lexer(normalizeMarkdownContent(content))
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

function renderTokenHtml(token: MarkdownToken): string {
  const tokenCopy = structuredClone(token)
  highlightTokenTree(tokenCopy)

  return sanitizeHTML(marked.parser([tokenCopy] as MarkdownToken[]))
}

function highlightTokenTree(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): void {
  if (!value || typeof value !== 'object') {
    return
  }

  if (seen.has(value)) {
    return
  }

  seen.add(value)

  applyCodeHighlight(value as HighlightableToken)

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        highlightTokenTree(item, seen)
      }
      continue
    }

    highlightTokenTree(child, seen)
  }
}

function applyCodeHighlight(token: HighlightableToken): void {
  if (token.type !== 'code' || typeof token.text !== 'string') {
    return
  }

  const highlighted = highlightCode(token.text, getLanguage(token.lang))

  if (highlighted !== token.text) {
    token.escaped = true
    token.text = highlighted
  }
}

function getLanguage(info: unknown): string {
  if (typeof info !== 'string') {
    return ''
  }

  return info.match(/\S*/)?.[0] ?? ''
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
