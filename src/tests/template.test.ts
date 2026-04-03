import fs from 'node:fs'
import {
  injectMarkdown,
  injectMarkdownTheme,
  injectTitle,
  prepareHTML,
  readHTMLTemplate,
} from '../template'

vi.mock('node:fs')

const HTML_WITH_MARKDOWN_OUTLET =
  '<html><body><!-- MARKDOWN_OUTLET --></body></html>'
const HTML_WITH_TITLE_OUTLET =
  '<html><head><!-- TITLE_OUTLET --></head><body></body></html>'
const HTML_WITH_THEME_OUTLET =
  '<html><head><!-- MARKDOWN_THEME_OUTLET --></head><body></body></html>'
const HTML_WITH_TITLE_AND_MARKDOWN_OUTLETS =
  '<html><head><!-- TITLE_OUTLET --><!-- MARKDOWN_THEME_OUTLET --></head><body><!-- MARKDOWN_OUTLET --></body></html>'
const MARKDOWN_HEADING = '<h1>Hello World</h1>'
const DEFAULT_MARKDOWN_PATH = '/path/to/document.md'
const DEFAULT_THEME_STYLES = '.markdown-body { color: CanvasText; }'
const DARK_THEME_STYLES = '.markdown-body { color: white; background: black; }'

function mockTemplateFile(
  template: string,
  themeStyles: Partial<Record<string, string>> = {},
) {
  vi.mocked(fs.readFileSync).mockImplementation((path) => {
    const filePath = String(path)

    if (filePath.includes('github-markdown-dark.css')) {
      return (themeStyles['dark'] ?? DARK_THEME_STYLES) as never
    }

    if (filePath.includes('github-markdown.css')) {
      return (themeStyles['default'] ?? DEFAULT_THEME_STYLES) as never
    }

    return template as never
  })
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
    const title = 'Document & <Special> "Characters"'

    const result = injectTitle(template, title)

    expect(result).toContain(
      '<title>Document &amp; &lt;Special&gt; &quot;Characters&quot;</title>',
    )
    expect(result).not.toContain('<Special>')
  })

  test('should escape apostrophes in title', () => {
    const template = HTML_WITH_TITLE_OUTLET
    const title = "Andrej's Notes"

    const result = injectTitle(template, title)

    expect(result).toContain('<title>Andrej&#39;s Notes</title>')
  })
})

describe('injectMarkdownTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTemplateFile(HTML_WITH_THEME_OUTLET)
  })

  test('should inject the selected markdown theme styles into template', () => {
    const result = injectMarkdownTheme(HTML_WITH_THEME_OUTLET, 'default')

    expect(result).toContain(
      '<style data-pvmd-markdown-theme>.markdown-body { color: CanvasText; }</style>',
    )
    expect(result).not.toContain('<!-- MARKDOWN_THEME_OUTLET -->')
  })

  test('should throw an error if MARKDOWN_THEME_OUTLET marker is missing', () => {
    const template = '<html><head></head><body></body></html>'

    expect(() => injectMarkdownTheme(template, 'default')).toThrow(
      'HTML template is missing the required markdown theme marker.\n' +
        'The template may be corrupted. Try reinstalling: npm install -g pvmd',
    )
  })
})

describe('prepareHTML', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTemplateFile(HTML_WITH_TITLE_AND_MARKDOWN_OUTLETS)
  })

  test('should prepare HTML with title and markdown', () => {
    const result = prepareHTML(
      DEFAULT_MARKDOWN_PATH,
      MARKDOWN_HEADING,
      'default',
    )

    expect(result).toContain('<title>document.md</title>')
    expect(result).toContain(DEFAULT_THEME_STYLES)
    expect(result).toContain(MARKDOWN_HEADING)
    expect(result).not.toContain('<!-- TITLE_OUTLET -->')
    expect(result).not.toContain('<!-- MARKDOWN_THEME_OUTLET -->')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
  })

  test('should still inject markdown if title injection fails', () => {
    mockTemplateFile(
      '<html><head><!-- MARKDOWN_THEME_OUTLET --></head><body><!-- MARKDOWN_OUTLET --></body></html>',
    )

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const result = prepareHTML(
      DEFAULT_MARKDOWN_PATH,
      MARKDOWN_HEADING,
      'default',
    )

    expect(result).toContain('<h1>Hello World</h1>')
    expect(result).not.toContain('<!-- MARKDOWN_OUTLET -->')
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  test('should extract filename from path correctly', () => {
    const result = prepareHTML(
      '/deep/nested/path/my-awesome-doc.md',
      '<p>Content</p>',
      'default',
    )

    expect(result).toContain('<title>my-awesome-doc.md</title>')
  })

  test('should work with relative paths', () => {
    const result = prepareHTML('README.md', '<p>Readme content</p>', 'default')

    expect(result).toContain('<title>README.md</title>')
    expect(result).toContain('<p>Readme content</p>')
  })

  test('should escape special characters in basename-derived title', () => {
    const result = prepareHTML(
      '/deep/nested/path/Document & <Special> "Name".md',
      '<p>Content</p>',
      'default',
    )

    expect(result).toContain(
      '<title>Document &amp; &lt;Special&gt; &quot;Name&quot;.md</title>',
    )
    expect(result).not.toContain(
      '<title>Document & <Special> "Name".md</title>',
    )
  })

  test('should inject the specifically requested theme stylesheet', () => {
    mockTemplateFile(HTML_WITH_TITLE_AND_MARKDOWN_OUTLETS)

    const result = prepareHTML(DEFAULT_MARKDOWN_PATH, MARKDOWN_HEADING, 'dark')

    expect(result).toContain(DARK_THEME_STYLES)
    expect(result).not.toContain(DEFAULT_THEME_STYLES)
  })
})
