import { applyContentEnhancements } from '../content-enhancements'

describe('content enhancements', () => {
  let mockWriteText: ReturnType<typeof vi.fn<() => Promise<void>>>

  function markdownContent() {
    return document.getElementById('markdown-content')!
  }

  beforeEach(() => {
    document.body.innerHTML = '<main id="markdown-content"></main>'
    mockWriteText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('adds a copy button to each code block', () => {
    const root = markdownContent()
    root.innerHTML =
      '<pre><code>const a = 1</code></pre><pre><code>const b = 2</code></pre>'

    applyContentEnhancements(root)

    const buttons = document.querySelectorAll('.copy-button')
    expect(buttons).toHaveLength(2)
    buttons.forEach((button) => {
      expect(button.getAttribute('aria-label')).toBe('Copy code')
    })
  })

  test('does not add copy buttons when there are no code blocks', () => {
    const root = markdownContent()
    root.innerHTML = '<p>No code here</p>'

    applyContentEnhancements(root)

    expect(document.querySelectorAll('.copy-button')).toHaveLength(0)
  })

  test('adds a copy icon to each button', () => {
    const root = markdownContent()
    root.innerHTML = '<pre><code>hello</code></pre>'

    applyContentEnhancements(root)

    const button = document.querySelector('.copy-button')
    const svg = button?.querySelector('svg[data-lucide="copy"]')
    expect(svg).toBeTruthy()
  })

  test('copies code text to clipboard on click', () => {
    const root = markdownContent()
    root.innerHTML = '<pre><code>console.log("hi")</code></pre>'

    applyContentEnhancements(root)
    document.querySelector<HTMLElement>('.copy-button')?.click()

    expect(mockWriteText).toHaveBeenCalledWith('console.log("hi")')
  })

  test('adds and removes the copied class as feedback', async () => {
    vi.useFakeTimers()
    const root = markdownContent()
    root.innerHTML = '<pre><code>x</code></pre>'

    applyContentEnhancements(root)
    const button = document.querySelector('.copy-button') as HTMLElement
    button.click()

    await vi.waitFor(() => {
      expect(button.classList.contains('copied')).toBe(true)
    })

    await vi.advanceTimersByTimeAsync(2000)
    expect(button.classList.contains('copied')).toBe(false)
  })

  test('disables rendered interactive controls while keeping copy buttons enabled', () => {
    const root = markdownContent()
    root.innerHTML =
      '<pre><code>console.log("hi")</code></pre><button>Click</button><input type="checkbox"><input type="text"><select><option>One</option></select><textarea>hello</textarea>'

    applyContentEnhancements(root)

    const copyButton = document.querySelector<HTMLButtonElement>('.copy-button')
    const button = document.querySelector<HTMLButtonElement>(
      '#markdown-content button:not(.copy-button)',
    )
    const checkbox = document.querySelector<HTMLInputElement>(
      '#markdown-content input[type="checkbox"]',
    )
    const textInput = document.querySelector<HTMLInputElement>(
      '#markdown-content input[type="text"]',
    )
    const select = document.querySelector<HTMLSelectElement>(
      '#markdown-content select',
    )
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '#markdown-content textarea',
    )

    expect(copyButton?.disabled).toBe(false)
    expect(copyButton?.getAttribute('aria-disabled')).toBeNull()
    expect(button?.getAttribute('aria-disabled')).toBe('true')
    expect(button?.getAttribute('tabindex')).toBe('-1')
    expect(checkbox?.disabled).toBe(true)
    expect(textInput?.disabled).toBe(true)
    expect(select?.disabled).toBe(true)
    expect(textarea?.disabled).toBe(true)
  })

  test('opens external links in a new tab', () => {
    const root = markdownContent()
    root.innerHTML =
      '<a href="https://example.com">HTTPS</a><a href="http://example.com">HTTP</a>'

    applyContentEnhancements(root)

    const links = document.querySelectorAll('a')
    const httpsLink = links[0]!
    expect(httpsLink.getAttribute('target')).toBe('_blank')
    expect(httpsLink.getAttribute('rel')).toBe('noopener noreferrer')

    const httpLink = links[1]!
    expect(httpLink.getAttribute('target')).toBe('_blank')
    expect(httpLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('leaves relative links in the current tab', () => {
    const root = markdownContent()
    root.innerHTML =
      '<a href="#heading">Anchor</a><a href="./other.md">Relative</a>'

    applyContentEnhancements(root)

    const links = document.querySelectorAll('a')
    for (const link of links) {
      expect(link.hasAttribute('target')).toBe(false)
    }
  })
})
