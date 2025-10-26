import {
  writeFileSync,
  mkdirSync,
  chmodSync,
  unlinkSync,
  rmdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MD_FILE_EXTENSIONS } from '../constants'
import { parseMarkdown, readMarkdownFile } from '../markdown'

describe('parseMarkdown', () => {
  test('should correctly parse headings', () => {
    expect(parseMarkdown('# Heading 1')).toContain('<h1>Heading 1</h1>')
    expect(parseMarkdown('## Heading 2')).toContain('<h2>Heading 2</h2>')
    expect(parseMarkdown('### Heading 3')).toContain('<h3>Heading 3</h3>')
    expect(parseMarkdown('#### Heading 4')).toContain('<h4>Heading 4</h4>')
    expect(parseMarkdown('##### Heading 5')).toContain('<h5>Heading 5</h5>')
    expect(parseMarkdown('###### Heading 6')).toContain('<h6>Heading 6</h6>')
    expect(parseMarkdown('#  Heading with spaces  ')).toContain(
      '<h1>Heading with spaces</h1>',
    )
  })

  test('should parse image correctly', () => {
    expect(parseMarkdown('<img src="test.jpg">')).toBe('<img src>')
  })

  describe('text formatting', () => {
    test('should parse bold text with **', () => {
      expect(parseMarkdown('**bold text**')).toContain(
        '<strong>bold text</strong>',
      )
    })

    test('should parse bold text with __', () => {
      expect(parseMarkdown('__bold text__')).toContain(
        '<strong>bold text</strong>',
      )
    })

    test('should parse italic text with *', () => {
      expect(parseMarkdown('*italic text*')).toContain('<em>italic text</em>')
    })

    test('should parse italic text with _', () => {
      expect(parseMarkdown('_italic text_')).toContain('<em>italic text</em>')
    })

    test('should parse bold and italic combined', () => {
      expect(parseMarkdown('***bold and italic***')).toContain(
        '<em><strong>bold and italic</strong></em>',
      )
    })

    test('should parse strikethrough text', () => {
      expect(parseMarkdown('~~strikethrough text~~')).toContain(
        '<del>strikethrough text</del>',
      )
    })
  })

  describe('lists', () => {
    test('should parse unordered lists with -', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).toContain('<li>Item 2</li>')
      expect(result).toContain('<li>Item 3</li>')
    })

    test('should parse unordered lists with *', () => {
      const markdown = '* Item 1\n* Item 2\n* Item 3'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
    })

    test('should parse unordered lists with +', () => {
      const markdown = '+ Item 1\n+ Item 2\n+ Item 3'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
    })

    test('should parse ordered lists', () => {
      const markdown = '1. First item\n2. Second item\n3. Third item'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<ol>')
      expect(result).toContain('<li>First item</li>')
      expect(result).toContain('<li>Second item</li>')
      expect(result).toContain('<li>Third item</li>')
    })

    test('should parse nested lists', () => {
      const markdown = '- Parent\n  - Child 1\n  - Child 2'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Parent')
    })
  })

  describe('links and images', () => {
    test('should parse inline links', () => {
      expect(parseMarkdown('[Google](https://google.com)')).toContain(
        '<a href="https://google.com">Google</a>',
      )
    })

    test('should parse links with titles', () => {
      expect(
        parseMarkdown('[Google](https://google.com "Google Search")'),
      ).toContain('title="Google Search"')
    })

    test('should parse autolinks', () => {
      expect(parseMarkdown('<https://google.com>')).toContain(
        '<a href="https://google.com">https://google.com</a>',
      )
    })

    test('should parse images', () => {
      expect(parseMarkdown('![Alt text](image.jpg)')).toContain(
        '<img src alt="Alt text">',
      )
    })

    test('should parse images with titles', () => {
      expect(parseMarkdown('![Alt text](image.jpg "Image title")')).toContain(
        'title="Image title"',
      )
    })
  })

  describe('code', () => {
    test('should parse inline code', () => {
      expect(parseMarkdown('`inline code`')).toContain(
        '<code>inline code</code>',
      )
    })

    test('should parse code blocks', () => {
      const markdown = '```\ncode block\n```'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<pre><code>code block')
    })

    test('should parse code blocks with language', () => {
      const markdown = '```javascript\nconst x = 1;\n```'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<pre><code>const x = 1;')
    })

    test('should parse indented code blocks', () => {
      const markdown = '    indented code'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<pre><code>indented code')
    })
  })

  describe('blockquotes', () => {
    test('should parse simple blockquotes', () => {
      expect(parseMarkdown('> This is a quote')).toContain('<blockquote>')
      expect(parseMarkdown('> This is a quote')).toContain(
        '<p>This is a quote</p>',
      )
    })

    test('should parse multi-line blockquotes', () => {
      const markdown = '> Line 1\n> Line 2\n> Line 3'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<blockquote>')
    })

    test('should parse nested blockquotes', () => {
      const markdown = '> Quote\n> > Nested quote'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<blockquote>')
    })
  })

  describe('horizontal rules', () => {
    test('should parse horizontal rules with ---', () => {
      expect(parseMarkdown('---')).toContain('<hr>')
    })

    test('should parse horizontal rules with ***', () => {
      expect(parseMarkdown('***')).toContain('<hr>')
    })

    test('should parse horizontal rules with ___', () => {
      expect(parseMarkdown('___')).toContain('<hr>')
    })
  })

  describe('tables (GFM)', () => {
    test('should parse simple tables', () => {
      const markdown =
        '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<table>')
      expect(result).toContain('<thead>')
      expect(result).toContain('<tbody>')
      expect(result).toContain('<th>Header 1</th>')
      expect(result).toContain('<td>Cell 1</td>')
    })

    test('should parse tables with alignment', () => {
      const markdown =
        '| Left | Center | Right |\n|:-----|:-----:|------:|\n| L1   |  C1   |   R1  |'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<table>')
    })
  })

  describe('line breaks', () => {
    test('should handle single line breaks', () => {
      const markdown = 'Line 1\nLine 2'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<p>Line 1\nLine 2</p>')
    })

    test('should handle double line breaks as paragraphs', () => {
      const markdown = 'Paragraph 1\n\nParagraph 2'
      const result = parseMarkdown(markdown)
      expect(result).toContain('<p>Paragraph 1</p>')
      expect(result).toContain('<p>Paragraph 2</p>')
    })
  })

  describe('complex combinations', () => {
    test('should handle mixed content', () => {
      const markdown = `# Main Heading

This is a **bold** paragraph with *italic* text and \`inline code\`.

## Subheading

- List item 1
- List item 2 with [link](https://example.com)

> This is a blockquote

\`\`\`javascript
const example = 'code block';
\`\`\``

      const result = parseMarkdown(markdown)
      expect(result).toContain('<h1>Main Heading</h1>')
      expect(result).toContain('<strong>bold</strong>')
      expect(result).toContain('<em>italic</em>')
      expect(result).toContain('<code>inline code</code>')
      expect(result).toContain('<h2>Subheading</h2>')
      expect(result).toContain('<ul>')
      expect(result).toContain('<a href="https://example.com">link</a>')
      expect(result).toContain('<blockquote>')
      expect(result).toContain('<pre><code>const example =')
    })
  })

  describe('XSS protection', () => {
    test('should properly escape closing main tag', () => {
      expect(parseMarkdown('</main>')).toBe('&lt;/main&gt;')
    })

    test('should escape script tags', () => {
      expect(parseMarkdown('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert("xss")&lt;/script&gt;',
      )
    })

    test('should escape javascript: URLs in links', () => {
      expect(parseMarkdown('[Click me](javascript:alert("xss"))')).toBe(
        '<p><a href>Click me</a></p>\n',
      )
    })

    test('should escape onclick attributes', () => {
      expect(
        parseMarkdown('<img onclick="alert(\'xss\')" src="test.jpg">'),
      ).toBe('<img src>')
    })

    test('should escape HTML entities in text', () => {
      expect(parseMarkdown('&lt;script&gt;')).toBe('<p>&lt;script&gt;</p>\n')
    })

    test('should escape dangerous HTML tags', () => {
      expect(parseMarkdown('<iframe src="evil.com"></iframe>')).toBe(
        '&lt;iframe src="evil.com"&gt;&lt;/iframe&gt;',
      )
    })
  })
})

describe('readMarkdownFile', () => {
  let tempDir: string
  let testFilePath: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `pvmd-test-${Date.now()}`)
    mkdirSync(tempDir)
    testFilePath = join(tempDir, 'test.md')
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist, ignore
    }
  })

  test('should throw path is directory error for directory', () => {
    const dirPath = join(tempDir, 'directory')
    mkdirSync(dirPath)

    expect(() => readMarkdownFile(dirPath)).toThrow(
      `Path is a directory: ${dirPath}`,
    )

    rmdirSync(dirPath)
  })

  test('should throw path is directory error for directory with .md extension', () => {
    const dirPath = join(tempDir, 'directory.md')
    mkdirSync(dirPath)

    expect(() => readMarkdownFile(dirPath)).toThrow(
      `Path is a directory: ${dirPath}`,
    )

    rmdirSync(dirPath)
  })

  test('should not throw error for valid markdown extensions', () => {
    MD_FILE_EXTENSIONS.forEach((ext) => {
      const testFile = join(tempDir, `test${ext}`)
      writeFileSync(testFile, '# Test content')

      expect(() => {
        const content = readMarkdownFile(testFile)
        expect(content).toBe('# Test content')
      }).not.toThrow()

      unlinkSync(testFile)
    })
  })

  test('should throw error for .js extension', () => {
    const testFilePath = join(tempDir, 'test.js')
    writeFileSync(testFilePath, '')

    expect(() => readMarkdownFile(testFilePath)).toThrow(
      `Invalid extension for path: ${testFilePath}.\nExpected extensions: ${MD_FILE_EXTENSIONS.join(', ')}`,
    )

    unlinkSync(testFilePath)
  })

  test('should be able to read existing test.md file', () => {
    const content = '# Test Markdown\n\nThis is a test file.'
    writeFileSync(testFilePath, content)

    const result = readMarkdownFile(testFilePath)
    expect(result).toBe(content)
  })

  test('should throw file not found error for non-existent file', () => {
    const nonExistentFile = join(tempDir, 'nonexistent.md')

    expect(() => readMarkdownFile(nonExistentFile)).toThrow(
      `File not found: ${nonExistentFile}`,
    )
  })

  test('should throw permission denied error for file without read permission', () => {
    writeFileSync(testFilePath, '# Test content')
    chmodSync(testFilePath, 0o000) // Remove all permissions

    expect(() => readMarkdownFile(testFilePath)).toThrow(
      `Permission denied: ${testFilePath}`,
    )

    chmodSync(testFilePath, 0o644) // Restore permissions for cleanup
  })

  test('should handle case insensitive extensions', () => {
    const upperCaseFile = join(tempDir, 'test.MD')
    writeFileSync(upperCaseFile, '# Test content')

    expect(() => {
      const content = readMarkdownFile(upperCaseFile)
      expect(content).toBe('# Test content')
    }).not.toThrow()

    unlinkSync(upperCaseFile)
  })

  test('should handle mixed case extensions', () => {
    const mixedCaseFile = join(tempDir, 'test.Md')
    writeFileSync(mixedCaseFile, '# Test content')

    expect(() => {
      const content = readMarkdownFile(mixedCaseFile)
      expect(content).toBe('# Test content')
    }).not.toThrow()

    unlinkSync(mixedCaseFile)
  })
})
