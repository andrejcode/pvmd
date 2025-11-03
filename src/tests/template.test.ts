import fs from 'node:fs'
import { injectMarkdown, readHTMLTemplate } from '../template'

vi.mock('node:fs')

describe('readHTMLTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should successfully read the HTML template', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return '<html><body><!-- MARKDOWN_OUTLET --></body></html>'
    })

    const template = readHTMLTemplate()
    expect(template).toContain('<!-- MARKDOWN_OUTLET -->')
  })

  test('should throw error if template file is missing', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    expect(() => readHTMLTemplate()).toThrow(
      'HTML template missing. The package may be corrupted.\n' +
        'Try reinstalling: npm install -g pvmd',
    )
  })
})

describe('injectMarkdown', () => {
  test('should successfully inject markdown into template', () => {
    const template = '<html><body><!-- MARKDOWN_OUTLET --></body></html>'
    const markdown = '<h1>Hello World</h1>'

    const result = injectMarkdown(template, markdown)

    expect(result).toBe('<html><body><h1>Hello World</h1></body></html>')
    expect(result).toContain('<h1>Hello World</h1>')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
  })

  test('should throw error if MARKDOWN_OUTLET marker is missing', () => {
    const template = '<html><body></body></html>'
    const markdown = '<h1>Hello World</h1>'

    expect(() => injectMarkdown(template, markdown)).toThrow(
      'HTML template is missing the required marker: <!-- MARKDOWN_OUTLET -->\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  })

  test('should work with empty markdown string', () => {
    const template = '<html><body><!-- MARKDOWN_OUTLET --></body></html>'
    const markdown = ''

    const result = injectMarkdown(template, markdown)

    expect(result).toBe('<html><body></body></html>')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
  })
})
