import {
  mkdirSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  chmodSync,
  unlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearRenderCaches, readMarkdownFile, renderMarkdownDocument } from '../index'

function renderMarkdown(markdown: string): string {
  return renderMarkdownDocument(markdown)
    .blocks.map((block) => block.html)
    .join('')
}

describe('renderMarkdownDocument', () => {
  // prettier-ignore
  test('should correctly parse headings', () => {
    expect(renderMarkdown('# Heading 1')).toContain('<h1 id="heading-1">Heading 1</h1>')
    expect(renderMarkdown('## Heading 2')).toContain('<h2 id="heading-2">Heading 2</h2>')
    expect(renderMarkdown('### Heading 3')).toContain('<h3 id="heading-3">Heading 3</h3>')
    expect(renderMarkdown('#### Heading 4')).toContain('<h4 id="heading-4">Heading 4</h4>')
    expect(renderMarkdown('##### Heading 5')).toContain('<h5 id="heading-5">Heading 5</h5>')
    expect(renderMarkdown('###### Heading 6')).toContain('<h6 id="heading-6">Heading 6</h6>')
    expect(renderMarkdown('#  Heading with spaces  ')).toContain(
      '<h1 id="heading-with-spaces">Heading with spaces</h1>',
    )
  })

  test('should keep heading ids stable in rendered markdown blocks', () => {
    const markdown = '# Heading\n\n[Jump](#heading)'
    const result = renderMarkdownDocument(markdown)

    expect(result.blocks[0]?.html).toContain('<h1 id="heading">Heading</h1>')
    expect(result.blocks[1]?.html).toContain('<a href="#heading">Jump</a>')
  })

  test('should reset heading ids between rendered markdown documents', () => {
    expect(renderMarkdownDocument('# Heading').blocks[0]?.html).toContain(
      '<h1 id="heading">Heading</h1>',
    )
    expect(renderMarkdownDocument('# Heading').blocks[0]?.html).toContain(
      '<h1 id="heading">Heading</h1>',
    )
  })

  describe('text formatting', () => {
    test('should parse bold text with **', () => {
      expect(renderMarkdown('**bold text**')).toContain(
        '<strong>bold text</strong>',
      )
    })

    test('should parse bold text with __', () => {
      expect(renderMarkdown('__bold text__')).toContain(
        '<strong>bold text</strong>',
      )
    })

    test('should parse italic text with *', () => {
      expect(renderMarkdown('*italic text*')).toContain('<em>italic text</em>')
    })

    test('should parse italic text with _', () => {
      expect(renderMarkdown('_italic text_')).toContain('<em>italic text</em>')
    })

    test('should parse bold and italic combined', () => {
      expect(renderMarkdown('***bold and italic***')).toContain(
        '<em><strong>bold and italic</strong></em>',
      )
    })

    test('should parse strikethrough text', () => {
      expect(renderMarkdown('~~strikethrough text~~')).toContain(
        '<del>strikethrough text</del>',
      )
    })

    test('should parse emoji shortcodes without remote assets', () => {
      const result = renderMarkdown('Launch time :rocket: :tada:')
      expect(result).toContain(
        '<p>Launch time <g-emoji>🚀</g-emoji> <g-emoji>🎉</g-emoji></p>',
      )
      expect(result).not.toContain('<img')
      expect(result).not.toContain('githubusercontent.com')
    })
  })

  describe('lists', () => {
    test('should parse unordered lists with -', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).toContain('<li>Item 2</li>')
      expect(result).toContain('<li>Item 3</li>')
    })

    test('should parse unordered lists with *', () => {
      const markdown = '* Item 1\n* Item 2\n* Item 3'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
    })

    test('should parse unordered lists with +', () => {
      const markdown = '+ Item 1\n+ Item 2\n+ Item 3'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
    })

    test('should parse ordered lists', () => {
      const markdown = '1. First item\n2. Second item\n3. Third item'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<ol>')
      expect(result).toContain('<li>First item</li>')
      expect(result).toContain('<li>Second item</li>')
      expect(result).toContain('<li>Third item</li>')
    })

    test('should parse nested lists', () => {
      const markdown = '- Parent\n  - Child 1\n  - Child 2'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Parent')
    })
  })

  describe('links and images', () => {
    test('should parse inline links', () => {
      expect(renderMarkdown('[Google](https://google.com)')).toContain(
        '<a href="https://google.com">Google</a>',
      )
    })

    test('should parse links with titles', () => {
      expect(
        renderMarkdown('[Google](https://google.com "Google Search")'),
      ).toContain('title="Google Search"')
    })

    test('should parse autolinks', () => {
      expect(renderMarkdown('<https://google.com>')).toContain(
        '<a href="https://google.com">https://google.com</a>',
      )
    })

    test('should parse images', () => {
      expect(renderMarkdown('![Alt text](image.jpg)')).toContain(
        '<img src="image.jpg" alt="Alt text">',
      )
    })

    test('should parse images with titles', () => {
      expect(renderMarkdown('![Alt text](image.jpg "Image title")')).toContain(
        'title="Image title"',
      )
    })

    test('should strip unsafe javascript links but keep link text', () => {
      const result = renderMarkdown('[Click me](<javascript:alert(1)>)')
      expect(result).toContain('<a>Click me</a>')
      expect(result).not.toContain('javascript:alert')
    })

    test('should keep safe data image sources', () => {
      const result = renderMarkdown(
        '<img src="data:image/png;base64,AAAA" alt="Inline">',
      )
      expect(result).toContain('src="data:image/png;base64,AAAA"')
    })
  })

  describe('code', () => {
    test('should parse inline code', () => {
      expect(renderMarkdown('`inline code`')).toContain(
        '<code>inline code</code>',
      )
    })

    test('should parse code blocks', () => {
      const markdown = '```\ncode block\n```'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<pre><code>code block')
    })

    test('should parse code blocks with language', () => {
      const markdown = '```javascript\nconst x = 1;\n```'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<pre><code class="language-javascript">')
      expect(result).toContain('const')
      expect(result).toContain('x')
      expect(result).toContain('1')
    })

    test('should preserve syntax highlighting in rendered markdown blocks', () => {
      const markdown = '```javascript\nconst x = 1;\n```'
      const result = renderMarkdownDocument(markdown)

      expect(result.blocks[0]?.html).toContain(
        '<pre><code class="language-javascript"><span class="pl-k">const</span>',
      )
    })

    test('should parse indented code blocks', () => {
      const markdown = '    indented code'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<pre><code>indented code')
    })
  })

  describe('blockquotes', () => {
    test('should parse simple blockquotes', () => {
      expect(renderMarkdown('> This is a quote')).toContain('<blockquote>')
      expect(renderMarkdown('> This is a quote')).toContain(
        '<p>This is a quote</p>',
      )
    })

    test('should parse multi-line blockquotes', () => {
      const markdown = '> Line 1\n> Line 2\n> Line 3'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<blockquote>')
    })

    test('should parse nested blockquotes', () => {
      const markdown = '> Quote\n> > Nested quote'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<blockquote>')
    })

    test('should parse GitHub-style alerts', () => {
      const markdown = '> [!NOTE]\n> hello alert'
      const result = renderMarkdown(markdown)

      expect(result).toContain(
        '<div class="markdown-alert markdown-alert-note">',
      )
      expect(result).toContain('<p class="markdown-alert-title">')
      expect(result).toContain('Note</p>')
      expect(result).toContain('<p>hello alert</p>')
    })

    test('should preserve GitHub-style alerts in rendered markdown blocks', () => {
      const markdown = '> [!NOTE]\n> hello alert'
      const result = renderMarkdownDocument(markdown)

      expect(result.blocks[0]?.html).toContain(
        '<div class="markdown-alert markdown-alert-note">',
      )
      expect(result.blocks[0]?.html).toContain(
        '<p class="markdown-alert-title">',
      )
      expect(result.blocks[0]?.html).toContain('Note</p>')
      expect(result.blocks[0]?.html).toContain('<p>hello alert</p>')
    })

    test('should render footnotes after referenced content in rendered markdown blocks', () => {
      const markdown = 'Paragraph with note[^1].\n\n[^1]: Footnote text'
      const result = renderMarkdownDocument(markdown)

      expect(result.html.indexOf('Paragraph with note')).toBeLessThan(
        result.html.indexOf('<section class="footnotes"'),
      )
      expect(result.html).toContain('href="#footnote-1"')
      expect(result.html).toContain('id="footnote-1"')
    })

    test('should update rendered footnotes when footnote content changes', () => {
      const previous = renderMarkdownDocument(
        'Paragraph with note[^1].\n\n[^1]: First',
      )
      const next = renderMarkdownDocument(
        'Paragraph with note[^1].\n\n[^1]: Second',
      )

      const previousFootnotes = previous.blocks.find((block) =>
        block.html.includes('<section class="footnotes"'),
      )
      const nextFootnotes = next.blocks.find((block) =>
        block.html.includes('<section class="footnotes"'),
      )

      expect(previousFootnotes?.id).not.toBe(nextFootnotes?.id)
      expect(nextFootnotes?.html).toContain('Second')
    })
  })

  describe('math (KaTeX)', () => {
    test('should render inline math', () => {
      const result = renderMarkdown('This is $E = mc^2$ inline.')
      expect(result).toContain('class="katex"')
      expect(result).toContain('<math')
    })

    test('should render block math', () => {
      const result = renderMarkdown('$$\n\\frac{a}{b}\n$$')
      expect(result).toContain('class="katex-display"')
      expect(result).toContain('<math')
    })

    test('should preserve inline math in rendered markdown blocks', () => {
      const result = renderMarkdownDocument('This is $E = mc^2$ inline.')
      expect(result.blocks[0]?.html).toContain('class="katex"')
      expect(result.blocks[0]?.html).toContain('<math')
    })

    test('should preserve block math in rendered markdown blocks', () => {
      const result = renderMarkdownDocument('$$\n\\frac{a}{b}\n$$')
      expect(result.blocks[0]?.html).toContain('class="katex-display"')
      expect(result.blocks[0]?.html).toContain('<math')
    })
  })

  describe('horizontal rules', () => {
    test('should parse horizontal rules with ---', () => {
      expect(renderMarkdown('---')).toContain('<hr>')
    })

    test('should parse horizontal rules with ***', () => {
      expect(renderMarkdown('***')).toContain('<hr>')
    })

    test('should parse horizontal rules with ___', () => {
      expect(renderMarkdown('___')).toContain('<hr>')
    })
  })

  describe('tables (GFM)', () => {
    test('should parse simple tables', () => {
      const markdown =
        '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<table>')
      expect(result).toContain('<thead>')
      expect(result).toContain('<tbody>')
      expect(result).toContain('<th>Header 1</th>')
      expect(result).toContain('<td>Cell 1</td>')
    })

    test('should parse tables with alignment', () => {
      const markdown =
        '| Left | Center | Right |\n|:-----|:-----:|------:|\n| L1   |  C1   |   R1  |'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<table>')
    })
  })

  describe('line breaks', () => {
    test('should handle single line breaks', () => {
      const markdown = 'Line 1\nLine 2'
      const result = renderMarkdown(markdown)
      expect(result).toContain('<p>Line 1\nLine 2</p>')
    })

    test('should handle double line breaks as paragraphs', () => {
      const markdown = 'Paragraph 1\n\nParagraph 2'
      const result = renderMarkdown(markdown)
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

      const result = renderMarkdown(markdown)
      expect(result).toContain('<h1 id="main-heading">Main Heading</h1>')
      expect(result).toContain('<strong>bold</strong>')
      expect(result).toContain('<em>italic</em>')
      expect(result).toContain('<code>inline code</code>')
      expect(result).toContain('<h2 id="subheading">Subheading</h2>')
      expect(result).toContain('<ul>')
      expect(result).toContain('<a href="https://example.com">link</a>')
      expect(result).toContain('<blockquote>')
      expect(result).toContain('<pre><code class="language-javascript">')
    })
  })

  describe('raw HTML safety', () => {
    test('should strip script tags from rendered output', () => {
      const result = renderMarkdown('<script>alert("xss")</script><p>safe</p>')
      expect(result).toBe('<p>safe</p>')
    })

    test('should strip interactive form controls except task list checkboxes', () => {
      const result = renderMarkdown(
        '<button>run</button><input type="text"><select><option>one</option></select><textarea>text</textarea>',
      )
      expect(result).not.toContain('<button')
      expect(result).not.toContain('<input')
      expect(result).not.toContain('<select')
      expect(result).not.toContain('<option')
      expect(result).not.toContain('<textarea')
    })

    test('should strip non-checkbox input elements from raw HTML', () => {
      const result = renderMarkdown('<input type="text" value="hello">')
      expect(result).not.toContain('<input')
    })

    test('should strip event handler attributes from raw HTML', () => {
      const result = renderMarkdown('<img src="image.jpg" onerror="alert(1)">')
      expect(result).toContain('<img src="image.jpg">')
      expect(result).not.toContain('onerror')
    })

    test('should preserve escaped script text inside fenced code blocks', () => {
      const result = renderMarkdown('```html\n<script>alert(1)</script>\n```')
      expect(result).toContain('&lt;')
      expect(result).toContain('script')
      expect(result).toContain('alert')
      expect(result).not.toContain('<script>alert(1)</script>')
      expect(result).toContain('<pre><code class="language-html">')
    })

    test('should preserve useful raw HTML elements', () => {
      const result = renderMarkdown(
        '<div style="color: red"><details><summary>Title</summary><kbd>Ctrl</kbd></details></div>',
      )
      expect(result).toContain('<div style="color: red">')
      expect(result).toContain(
        '<details><summary>Title</summary><kbd>Ctrl</kbd></details>',
      )
    })

    test('should preserve markdown task list checkboxes', () => {
      const result = renderMarkdown('- [x] done\n- [ ] todo')
      expect(result).toContain('type="checkbox"')
      expect(result).toContain('disabled')
    })
  })

  describe('render caching', () => {
    beforeEach(() => {
      clearRenderCaches()
    })

    test('should produce identical heading ids from cached and uncached renders', () => {
      const markdown = '# Heading\n\n## Subheading\n\n### Heading'
      const first = renderMarkdownDocument(markdown)
      clearRenderCaches()
      const second = renderMarkdownDocument(markdown)

      expect(first.html).toBe(second.html)
      expect(first.blocks.map((b) => b.id)).toEqual(second.blocks.map((b) => b.id))
    })

    test('should produce identical heading ids on repeated render without cache clear', () => {
      const markdown = '# Title\n\nSome text.\n\n# Title'
      const first = renderMarkdownDocument(markdown)
      const second = renderMarkdownDocument(markdown)

      expect(first.html).toBe(second.html)
      expect(first.blocks.map((b) => b.html)).toEqual(
        second.blocks.map((b) => b.html),
      )
    })

    test('should produce identical footnote output from cached and uncached renders', () => {
      const markdown = 'Text with note[^1].\n\n[^1]: Footnote text'
      const first = renderMarkdownDocument(markdown)
      clearRenderCaches()
      const second = renderMarkdownDocument(markdown)

      expect(first.html).toBe(second.html)
      expect(first.html).toContain('href="#footnote-1"')
      expect(first.html).toContain('id="footnote-1"')
    })

    test('should produce identical syntax-highlighted code block output from cached and uncached renders', () => {
      const markdown = '```javascript\nconst x = 1;\n```'
      const first = renderMarkdownDocument(markdown)
      clearRenderCaches()
      const second = renderMarkdownDocument(markdown)

      expect(first.html).toBe(second.html)
      expect(first.blocks[0]?.html).toContain(
        '<pre><code class="language-javascript"><span class="pl-k">const</span>',
      )
    })

    test('should return different blocks for different code content after cache clear', () => {
      const first = renderMarkdownDocument('```javascript\nconst x = 1;\n```')
      clearRenderCaches()
      const second = renderMarkdownDocument('```javascript\nconst y = 2;\n```')

      expect(first.blocks[0]?.html).not.toBe(second.blocks[0]?.html)
    })
  })
})

describe('readMarkdownFile', () => {
  let tempDir: string
  let testFilePath: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `pvmd-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
    testFilePath = join(tempDir, 'test.md')
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist, ignore
    }
  })

  test('should successfully read a valid markdown file', () => {
    const content = '# Test Markdown\n\nThis is a test file.'
    writeFileSync(testFilePath, content)

    const result = readMarkdownFile(testFilePath)
    expect(result).toBe(content)
  })

  test('should throw an error for invalid file extension', () => {
    const testFile = join(tempDir, 'test.js')
    writeFileSync(testFile, '# Test content')

    const validExtensions = [
      '.md',
      '.markdown',
      '.mdown',
      '.mkdn',
      '.mkd',
      '.mdwn',
      '.mdtxt',
      '.mdtext',
    ]

    expect(() => readMarkdownFile(testFile)).toThrow(
      `Invalid extension for path: ${testFile}.\nExpected extensions: ${validExtensions.join(', ')}`,
    )

    unlinkSync(testFile)
  })

  test('should throw an error when path is a directory', () => {
    const dirPath = join(tempDir, 'directory')
    mkdirSync(dirPath)

    expect(() => readMarkdownFile(dirPath)).toThrow(
      `Path is a directory: ${dirPath}`,
    )
  })

  test('should throw an error when path is a directory with .md extension', () => {
    const dirPath = join(tempDir, 'directory.md')
    mkdirSync(dirPath)

    expect(() => readMarkdownFile(dirPath)).toThrow(
      `Path is a directory: ${dirPath}`,
    )
  })

  test('should throw an error when path is a symbolic link', () => {
    const targetFile = join(tempDir, 'target.md')
    writeFileSync(targetFile, '# Target content')
    const symlinkPath = join(tempDir, 'symlink.md')
    symlinkSync(targetFile, symlinkPath)

    expect(() => readMarkdownFile(symlinkPath)).toThrow(
      `Path is a symbolic link: ${symlinkPath}`,
    )

    unlinkSync(symlinkPath)
    unlinkSync(targetFile)
  })

  test('should throw an error message for non-existent file', () => {
    const nonExistentFile = join(tempDir, 'nonexistent.md')

    expect(() => readMarkdownFile(nonExistentFile)).toThrow(
      `File not found: ${nonExistentFile}`,
    )
  })

  test('should throw an error for file without read permission', () => {
    writeFileSync(testFilePath, '# Test content')
    chmodSync(testFilePath, 0o000) // Remove all permissions

    expect(() => readMarkdownFile(testFilePath)).toThrow(
      `Permission denied: ${testFilePath}`,
    )

    // Restore permissions for cleanup
    chmodSync(testFilePath, 0o644)
  })
})
