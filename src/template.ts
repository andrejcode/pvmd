import { readFileSync } from 'node:fs'

export function readHTMLTemplate(): string {
  try {
    return readFileSync(new URL('./client/index.html', import.meta.url), 'utf8')
  } catch {
    throw new Error(
      'HTML template missing. The package may be corrupted.\n' +
        'Try reinstalling: npm install -g pvmd',
    )
  }
}

export function injectMarkdown(template: string, markdown: string): string {
  return template.replace('<!-- MARKDOWN_OUTLET -->', markdown)
}
