import fs from 'node:fs'
import {
  injectMarkdown,
  injectTitle,
  prepareHTML,
  readHTMLTemplate,
} from '../template'

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
      'HTML template missing. The template may be corrupted.\n' +
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
      'HTML template is missing the required markdown marker.\n' +
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

describe('injectTitle', () => {
  test('should successfully inject title into template', () => {
    const template =
      '<html><head><!-- TITLE_OUTLET --></head><body></body></html>'
    const title = 'README.md'

    const result = injectTitle(template, title)

    expect(result).toBe(
      '<html><head><title>README.md</title></head><body></body></html>',
    )
    expect(result).toContain('<title>README.md</title>')
    expect(result).not.toContain('<!-- TITLE_OUTLET -->')
  })

  test('should throw error if TITLE_OUTLET marker is missing', () => {
    const template = '<html><head></head><body></body></html>'
    const title = 'README.md'

    expect(() => injectTitle(template, title)).toThrow(
      'Unable to update title because HTML template is missing the required title marker.\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  })

  test('should work with empty title string', () => {
    const template =
      '<html><head><!-- TITLE_OUTLET --></head><body></body></html>'
    const title = ''

    const result = injectTitle(template, title)

    expect(result).toBe(
      '<html><head><title></title></head><body></body></html>',
    )
    expect(result).not.toContain('<!-- TITLE_OUTLET -->')
  })

  test('should handle special characters in title', () => {
    const template =
      '<html><head><!-- TITLE_OUTLET --></head><body></body></html>'
    const title = 'Document & <Special> Characters'

    const result = injectTitle(template, title)

    expect(result).toContain('<title>Document & <Special> Characters</title>')
  })
})

describe('prepareHTML', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should prepare HTML with title and markdown', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return '<html><head><!-- TITLE_OUTLET --></head><body><!-- MARKDOWN_OUTLET --></body></html>'
    })

    const pathToMarkdownFile = '/path/to/document.md'
    const parsedMarkdown = '<h1>Hello World</h1>'

    const result = prepareHTML(pathToMarkdownFile, parsedMarkdown)

    expect(result).toContain('<title>document.md</title>')
    expect(result).toContain('<h1>Hello World</h1>')
    expect(result).not.toContain('<!-- TITLE_OUTLET -->')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
  })

  test('should still inject markdown if title injection fails', () => {
    // Template without TITLE_OUTLET marker
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return '<html><head></head><body><!-- MARKDOWN_OUTLET --></body></html>'
    })

    const pathToMarkdownFile = '/path/to/document.md'
    const parsedMarkdown = '<h1>Hello World</h1>'

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const result = prepareHTML(pathToMarkdownFile, parsedMarkdown)

    expect(result).toContain('<h1>Hello World</h1>')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  test('should extract filename from path correctly', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return '<html><head><!-- TITLE_OUTLET --></head><body><!-- MARKDOWN_OUTLET --></body></html>'
    })

    const pathToMarkdownFile = '/deep/nested/path/my-awesome-doc.md'
    const parsedMarkdown = '<p>Content</p>'

    const result = prepareHTML(pathToMarkdownFile, parsedMarkdown)

    expect(result).toContain('<title>my-awesome-doc.md</title>')
  })

  test('should work with relative paths', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return '<html><head><!-- TITLE_OUTLET --></head><body><!-- MARKDOWN_OUTLET --></body></html>'
    })

    const pathToMarkdownFile = 'README.md'
    const parsedMarkdown = '<p>Readme content</p>'

    const result = prepareHTML(pathToMarkdownFile, parsedMarkdown)

    expect(result).toContain('<title>README.md</title>')
    expect(result).toContain('<p>Readme content</p>')
  })
})
