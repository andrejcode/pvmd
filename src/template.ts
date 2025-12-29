import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
      'HTML template missing. The package may be corrupted.\n' +
        'Try reinstalling: npm install -g pvmd',
    )
  }
}

export function injectMarkdown(template: string, markdown: string): string {
  if (!template.includes('<!-- MARKDOWN_OUTLET -->')) {
    throw new Error(
      'HTML template is missing the required marker: <!-- MARKDOWN_OUTLET -->\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  }

  return template.replace('<!-- MARKDOWN_OUTLET -->', markdown)
}
