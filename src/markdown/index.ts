import { readFileSync } from 'node:fs'
import { common, createStarryNight } from '@wooorm/starry-night'
import { nameToEmoji } from 'gemoji'
import { toHtml } from 'hast-util-to-html'
import { Marked } from 'marked'
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

function createMarkdownParser(): Marked {
  return new Marked(
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
    {
      renderer: {
        code({ text, lang }) {
          if (!isMermaidLanguage(lang)) {
            return false
          }

          return `<pre class="mermaid">${escapeHtmlText(text)}</pre>\n`
        },
      },
    },
  )
}

type MarkdownToken = ReturnType<Marked['lexer']>[number]
type MarkdownTokenGroup = MarkdownToken[]

export function renderMarkdownBlocks(
  content: string,
  httpsOnly = false,
): LiveUpdateBlock[] {
  const marked = createMarkdownParser()
  const normalizedContent = preprocessMarkdownContent(
    normalizeMarkdownContent(content).replace(/\r\n?/g, '\n'),
    marked,
  )
  const tokens = marked.lexer(normalizedContent)
  const sourceLines = locateSourceLines(tokens, normalizedContent)
  const tokenGroups = groupDisclosureTokens(
    walkMarkdownTokens(processMarkdownTokens(tokens, marked), marked),
  )
  const blockOccurrences = new Map<string, number>()

  const blocks: LiveUpdateBlock[] = []

  for (const tokenGroup of tokenGroups) {
    const html = renderTokensHtml(tokenGroup, httpsOnly, marked)
    if (!html.trim()) {
      continue
    }

    const key = getBlockKey(tokenGroup, html)
    const occurrence = (blockOccurrences.get(key) ?? 0) + 1
    blockOccurrences.set(key, occurrence)

    const id = createBlockId(getBlockType(tokenGroup), key, occurrence)
    const ranges = tokenGroup.flatMap((token) => {
      const range = sourceLines.get(token)
      return range ? [range] : []
    })

    blocks.push({
      id,
      html,
      ...(ranges.length
        ? {
            sourceStartLine: Math.min(...ranges.map((range) => range.start)),
            sourceEndLine: Math.max(...ranges.map((range) => range.end)),
          }
        : {}),
    })
  }

  return blocks
}

function locateSourceLines(
  tokens: MarkdownToken[],
  content: string,
): Map<MarkdownToken, { start: number; end: number }> {
  const ranges = new Map<MarkdownToken, { start: number; end: number }>()
  let offset = 0
  let line = 1
  for (const token of tokens) {
    // The footnotes extension adds a synthetic token and later moves it.
    if (token.type === 'footnotes') continue
    const raw = getTokenRaw(token)
    if (!raw) continue
    const start = content.indexOf(raw, offset)
    if (start === -1) continue
    line += content.slice(offset, start).split('\n').length - 1
    ranges.set(token, {
      start: line,
      end: line + raw.replace(/\n+$/, '').split('\n').length - 1,
    })
    line += raw.split('\n').length - 1
    offset = start + raw.length
  }
  return ranges
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

function preprocessMarkdownContent(content: string, marked: Marked): string {
  return marked.defaults.hooks?.preprocess?.call(marked, content) ?? content
}

function processMarkdownTokens(
  tokens: MarkdownToken[],
  marked: Marked,
): MarkdownToken[] {
  return marked.defaults.hooks?.processAllTokens?.call(marked, tokens) ?? tokens
}

function walkMarkdownTokens(
  tokens: MarkdownToken[],
  marked: Marked,
): MarkdownToken[] {
  if (marked.defaults.walkTokens) {
    void marked.walkTokens(tokens, marked.defaults.walkTokens)
  }

  return tokens
}

function groupDisclosureTokens(tokens: MarkdownToken[]): MarkdownTokenGroup[] {
  const groups: MarkdownTokenGroup[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!

    if (!opensDetailsElement(token)) {
      groups.push([token])
      continue
    }

    const group: MarkdownTokenGroup = []
    let depth = 0
    let matchedClose = false

    for (let groupIndex = index; groupIndex < tokens.length; groupIndex += 1) {
      const groupToken = tokens[groupIndex]!
      group.push(groupToken)
      depth += getDetailsDepthDelta(groupToken)

      if (depth <= 0) {
        matchedClose = true
        index = groupIndex
        break
      }
    }

    if (matchedClose) {
      groups.push(group)
      continue
    }

    groups.push([token])
  }

  return groups
}

function opensDetailsElement(token: MarkdownToken): boolean {
  return getDetailsDepthDelta(token) > 0
}

function getDetailsDepthDelta(token: MarkdownToken): number {
  const html = getTokenHtml(token)
  if (!html) return 0

  let depth = 0
  const tagPattern = /<\/?\s*details(?:\s[^>]*)?>/gi

  for (const match of html.matchAll(tagPattern)) {
    depth += match[0].startsWith('</') ? -1 : 1
  }

  return depth
}

function getTokenHtml(token: MarkdownToken): string {
  return token.type === 'html' &&
    'text' in token &&
    typeof token.text === 'string'
    ? token.text
    : ''
}

function renderTokensHtml(
  tokenGroup: MarkdownTokenGroup,
  httpsOnly: boolean,
  marked: Marked,
): string {
  const key = getRenderCacheKey(tokenGroup, httpsOnly)
  const cached = blockHtmlCache.get(key)
  if (cached !== undefined) return cached
  const result = sanitizeHTML(
    marked.parser(structuredClone(tokenGroup)),
    httpsOnly,
  )
  blockHtmlCache.set(key, result)
  return result
}

function getRenderCacheKey(
  tokenGroup: MarkdownTokenGroup,
  httpsOnly: boolean,
): string {
  const mode = httpsOnly ? 'https-only' : 'default'
  return `${mode}\x00${JSON.stringify(tokenGroup)}`
}

function isMermaidLanguage(lang: string | undefined): boolean {
  return (lang ?? '').trim().split(/\s+/, 1)[0]?.toLowerCase() === 'mermaid'
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightCode(code: string, lang: string): string {
  if (isMermaidLanguage(lang)) {
    // Mermaid blocks are rendered client-side from their raw source.
    return code
  }

  const key = `${lang}\x00${code}`
  const cached = highlightCache.get(key)
  if (cached !== undefined) return cached
  const scope = starryNight.flagToScope(lang)
  const result = scope ? toHtml(starryNight.highlight(code, scope)) : code
  highlightCache.set(key, result)
  return result
}

function getBlockKey(tokenGroup: MarkdownTokenGroup, html: string): string {
  const raw = tokenGroup.map((token) => getTokenRaw(token)).join('')
  const content = html || raw
  return `${getBlockType(tokenGroup)}:${content}`
}

function getTokenRaw(token: MarkdownToken): string {
  return 'raw' in token && typeof token.raw === 'string' ? token.raw : ''
}

function getBlockType(tokenGroup: MarkdownTokenGroup): string {
  return tokenGroup.length === 1 ? tokenGroup[0]!.type : 'html'
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
