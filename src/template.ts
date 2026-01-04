import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

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

  return template.replace('<!-- TITLE_OUTLET -->', `<title>${title}</title>`)
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

export function prepareHTML(
  pathToMarkdownFile: string,
  parsedMarkdown: string,
): string {
  const htmlTemplate = readHTMLTemplate()

  let htmlTemplateWithTitle = ''
  try {
    const fileName = basename(pathToMarkdownFile)
    htmlTemplateWithTitle = injectTitle(htmlTemplate, fileName)
  } catch (error) {
    console.error(error)
  }

  return injectMarkdown(htmlTemplateWithTitle || htmlTemplate, parsedMarkdown)
}
