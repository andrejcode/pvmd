import fs from 'node:fs'
import {
  injectMarkdown,
  injectTitle,
  prepareHTML,
  readHTMLTemplate,
} from '../template'

vi.mock('node:fs')

const HTML_WITH_MARKDOWN_OUTLET =
  '<html><body><!-- MARKDOWN_OUTLET --></body></html>'
const HTML_WITH_TITLE_OUTLET =
  '<html><head><!-- TITLE_OUTLET --></head><body></body></html>'
const HTML_WITH_TITLE_AND_MARKDOWN_OUTLETS =
  '<html><head><!-- TITLE_OUTLET --></head><body><!-- MARKDOWN_OUTLET --></body></html>'
const MARKDOWN_HEADING = '<h1>Hello World</h1>'
const DEFAULT_MARKDOWN_PATH = '/path/to/document.md'

function mockTemplateFile(template: string) {
  vi.mocked(fs.readFileSync).mockImplementation(() => template)
}

describe('readHTMLTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should successfully read the HTML template', () => {
    mockTemplateFile(HTML_WITH_MARKDOWN_OUTLET)

    const template = readHTMLTemplate()
    expect(template).toContain('<!-- MARKDOWN_OUTLET -->')
  })

  test('should throw an error if template file is missing', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    expect(() => readHTMLTemplate()).toThrow(
      'HTML template missing. The template may be corrupted.\n' +
        'Try reinstalling: npm install -g pvmd',
    )
  })
})

describe('injectMarkdown', () => {
  test('should successfully inject markdown into template', () => {
    const template = HTML_WITH_MARKDOWN_OUTLET
    const markdown = MARKDOWN_HEADING

    const result = injectMarkdown(template, markdown)

    expect(result).toBe('<html><body><h1>Hello World</h1></body></html>')
    expect(result).toContain(MARKDOWN_HEADING)
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
  })

  test('should throw an error if MARKDOWN_OUTLET marker is missing', () => {
    const template = '<html><body></body></html>'
    const markdown = MARKDOWN_HEADING

    expect(() => injectMarkdown(template, markdown)).toThrow(
      'HTML template is missing the required markdown marker.\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  })

  test('should work with empty markdown string', () => {
    const template = HTML_WITH_MARKDOWN_OUTLET
    const markdown = ''

    const result = injectMarkdown(template, markdown)

    expect(result).toBe('<html><body></body></html>')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
  })
})

describe('injectTitle', () => {
  test('should successfully inject title into template', () => {
    const template = HTML_WITH_TITLE_OUTLET
    const title = 'README.md'

    const result = injectTitle(template, title)

    expect(result).toBe(
      '<html><head><title>README.md</title></head><body></body></html>',
    )
    expect(result).toContain('<title>README.md</title>')
    expect(result).not.toContain('<!-- TITLE_OUTLET -->')
  })

  test('should throw an error if TITLE_OUTLET marker is missing', () => {
    const template = '<html><head></head><body></body></html>'
    const title = 'README.md'

    expect(() => injectTitle(template, title)).toThrow(
      'Unable to update title because HTML template is missing the required title marker.\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  })

  test('should work with empty title string', () => {
    const template = HTML_WITH_TITLE_OUTLET
    const title = ''

    const result = injectTitle(template, title)

    expect(result).toBe(
      '<html><head><title></title></head><body></body></html>',
    )
    expect(result).not.toContain('<!-- TITLE_OUTLET -->')
  })

  test('should handle special characters in title', () => {
    const template = HTML_WITH_TITLE_OUTLET
    const title = 'Document & <Special> Characters'

    const result = injectTitle(template, title)

    expect(result).toContain('<title>Document & <Special> Characters</title>')
  })
})

describe('prepareHTML', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTemplateFile(HTML_WITH_TITLE_AND_MARKDOWN_OUTLETS)
  })

  test('should prepare HTML with title and markdown', () => {
    const result = prepareHTML(DEFAULT_MARKDOWN_PATH, MARKDOWN_HEADING)

    expect(result).toContain('<title>document.md</title>')
    expect(result).toContain(MARKDOWN_HEADING)
    expect(result).not.toContain('<!-- TITLE_OUTLET -->')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
  })

  test('should still inject markdown if title injection fails', () => {
    mockTemplateFile(
      '<html><head></head><body><!-- MARKDOWN_OUTLET --></body></html>',
    )

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const result = prepareHTML(DEFAULT_MARKDOWN_PATH, MARKDOWN_HEADING)

    expect(result).toContain('<h1>Hello World</h1>')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  test('should extract filename from path correctly', () => {
    const result = prepareHTML(
      '/deep/nested/path/my-awesome-doc.md',
      '<p>Content</p>',
    )

    expect(result).toContain('<title>my-awesome-doc.md</title>')
  })

  test('should work with relative paths', () => {
    const result = prepareHTML('README.md', '<p>Readme content</p>')

    expect(result).toContain('<title>README.md</title>')
    expect(result).toContain('<p>Readme content</p>')
  })
})
