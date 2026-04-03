import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, resolve } from 'node:path'
import { type ThemeOption } from './cli/config'

const HTML_ESCAPE_LOOKUP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const require = createRequire(import.meta.url)

const MARKDOWN_THEME_OUTLET = '<!-- MARKDOWN_THEME_OUTLET -->'

const THEME_STYLESHEET_PATHS: Record<ThemeOption, string> = {
  default: 'github-markdown-css/github-markdown.css',
  light: 'github-markdown-css/github-markdown-light.css',
  dark: 'github-markdown-css/github-markdown-dark.css',
  'dark-dimmed': 'github-markdown-css/github-markdown-dark-dimmed.css',
  'dark-high-contrast':
    'github-markdown-css/github-markdown-dark-high-contrast.css',
  'dark-colorblind': 'github-markdown-css/github-markdown-dark-colorblind.css',
  'light-colorblind':
    'github-markdown-css/github-markdown-light-colorblind.css',
}

const markdownThemeCache = new Map<ThemeOption, string>()

export function readHTMLTemplate(): string {
  try {
    // In development mode, read from the dev build directory
    if (process.env['NODE_ENV'] === 'development') {
      const devPath = resolve(process.cwd(), '.dev-build/client/index.html')
      return readFileSync(devPath, 'utf8')
    }

    return readFileSync(new URL('./client/index.html', import.meta.url), 'utf8')
  } catch {
    throw new Error(
      'HTML template missing. The template may be corrupted.\n' +
        'Try reinstalling: npm install -g pvmd',
    )
  }
}

export function injectTitle(template: string, title: string): string {
  if (!template.includes('<!-- TITLE_OUTLET -->')) {
    throw new Error(
      'Unable to update title because HTML template is missing the required title marker.\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  }

  const escapedTitle = escapeHtmlText(title)

  return template.replace(
    '<!-- TITLE_OUTLET -->',
    `<title>${escapedTitle}</title>`,
  )
}

export function injectMarkdown(template: string, markdown: string): string {
  if (!template.includes('<!-- MARKDOWN_OUTLET -->')) {
    throw new Error(
      'HTML template is missing the required markdown marker.\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  }

  return template.replace('<!-- MARKDOWN_OUTLET -->', markdown)
}

export function injectMarkdownTheme(
  template: string,
  theme: ThemeOption,
): string {
  if (!template.includes(MARKDOWN_THEME_OUTLET)) {
    throw new Error(
      'HTML template is missing the required markdown theme marker.\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  }

  const themeCss = readMarkdownThemeStyles(theme)

  return template.replace(
    MARKDOWN_THEME_OUTLET,
    `<style data-pvmd-markdown-theme>${themeCss}</style>`,
  )
}

export function prepareHTML(
  pathToMarkdownFile: string,
  parsedMarkdown: string,
  theme: ThemeOption,
): string {
  const htmlTemplate = injectMarkdownTheme(readHTMLTemplate(), theme)

  let htmlTemplateWithTitle = ''
  try {
    const fileName = basename(pathToMarkdownFile)
    htmlTemplateWithTitle = injectTitle(htmlTemplate, fileName)
  } catch (error) {
    console.error(error)
  }

  return injectMarkdown(htmlTemplateWithTitle || htmlTemplate, parsedMarkdown)
}

function readMarkdownThemeStyles(theme: ThemeOption): string {
  const cachedThemeStyles = markdownThemeCache.get(theme)
  if (cachedThemeStyles) {
    return cachedThemeStyles
  }

  try {
    const stylesheetPath = require.resolve(THEME_STYLESHEET_PATHS[theme])
    const themeStyles = readFileSync(stylesheetPath, 'utf8')
    markdownThemeCache.set(theme, themeStyles)
    return themeStyles
  } catch {
    throw new Error(
      'Markdown theme stylesheet missing. The installation may be corrupted.\n' +
        'Try reinstalling: npm install -g pvmd',
    )
  }
}

function escapeHtmlText(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPE_LOOKUP[character]!,
  )
}
