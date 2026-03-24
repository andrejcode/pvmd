describe('main', () => {
  const INITIAL_BODY_HTML = `
      <div id="disconnected-alert" hidden>
        <span id="alert-message">Connection lost. Waiting to reconnect...</span>
        <button id="alert-close" aria-label="Close alert"></button>
      </div>
      <main id="markdown-content" role="article" aria-live="polite" aria-atomic="false" aria-label="Markdown content"></main>
      <template id="icon-copy"><svg data-testid="copy-icon"></svg></template>
    `
  let mockEventSource: {
    onopen: (() => void) | null
    onerror: (() => void) | null
    onmessage: ((event: MessageEvent) => void) | null
  }
  let mockWriteText: ReturnType<typeof vi.fn<() => Promise<void>>>

  async function loadMain() {
    await import('../main')
  }

  function sendMarkdown(html: string) {
    if (mockEventSource.onmessage) {
      mockEventSource.onmessage(
        new MessageEvent('message', { data: JSON.stringify(html) }),
      )
    }
  }

  function sendPatch(ops: Array<Record<string, unknown>>) {
    if (mockEventSource.onmessage) {
      mockEventSource.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify({ kind: 'patch', ops }),
        }),
      )
    }
  }

  beforeEach(() => {
    document.body.innerHTML = INITIAL_BODY_HTML

    mockWriteText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    })

    mockEventSource = {
      onopen: null,
      onerror: null,
      onmessage: null,
    }
    ;(globalThis as Record<string, unknown>)['EventSource'] = vi.fn(
      function () {
        return mockEventSource
      },
    )

    vi.resetModules()
  })

  describe('markdown content', () => {
    test('should update markdown content on message', async () => {
      await loadMain()

      const markdownContent = document.getElementById('markdown-content')
      const testHtml = '<h1>Test Content</h1>'

      sendMarkdown(testHtml)

      expect(markdownContent?.innerHTML).toBe(testHtml)
    })

    test('should insert only the patched block content', async () => {
      await loadMain()

      sendMarkdown('<div data-pvmd-block-id="block-1"><p>Before</p></div>')
      sendPatch([
        {
          type: 'insert',
          html: '<div data-pvmd-block-id="block-2"><p>After</p></div>',
        },
      ])

      const blocks = document.querySelectorAll('[data-pvmd-block-id]')
      expect(blocks).toHaveLength(2)
      expect(
        document.getElementById('markdown-content')?.textContent,
      ).toContain('Before')
      expect(
        document.getElementById('markdown-content')?.textContent,
      ).toContain('After')
    })

    test('should disable rendered interactive controls', async () => {
      await loadMain()

      sendMarkdown(
        '<button>Click</button><input type="checkbox"><input type="text"><select><option>One</option></select><textarea>hello</textarea>',
      )

      const button = document.querySelector<HTMLButtonElement>(
        '#markdown-content button',
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

      expect(button?.getAttribute('aria-disabled')).toBe('true')
      expect(button?.getAttribute('tabindex')).toBe('-1')
      expect(checkbox?.disabled).toBe(true)
      expect(textInput?.disabled).toBe(true)
      expect(select?.disabled).toBe(true)
      expect(textarea?.disabled).toBe(true)
    })
  })

  describe('copy buttons', () => {
    test('should add a copy button to each code block', async () => {
      await loadMain()

      sendMarkdown(
        '<pre><code>const a = 1</code></pre><pre><code>const b = 2</code></pre>',
      )

      const buttons = document.querySelectorAll('.copy-button')
      expect(buttons).toHaveLength(2)
      buttons.forEach((btn) => {
        expect(btn.getAttribute('aria-label')).toBe('Copy code')
      })
    })

    test('should not add copy buttons when there are no code blocks', async () => {
      await loadMain()

      sendMarkdown('<p>No code here</p>')

      expect(document.querySelectorAll('.copy-button')).toHaveLength(0)
    })

    test('should clone the icon template into each button', async () => {
      await loadMain()

      sendMarkdown('<pre><code>hello</code></pre>')

      const button = document.querySelector('.copy-button')
      const svg = button?.querySelector('svg')
      expect(svg).toBeTruthy()
    })

    test('should copy code text to clipboard on click', async () => {
      await loadMain()

      sendMarkdown('<pre><code>console.log("hi")</code></pre>')

      const button = document.querySelector('.copy-button') as HTMLElement
      button.click()

      expect(mockWriteText).toHaveBeenCalledWith('console.log("hi")')
    })

    test('should add and remove the "copied" class as feedback', async () => {
      vi.useFakeTimers()
      await loadMain()

      sendMarkdown('<pre><code>x</code></pre>')

      const button = document.querySelector('.copy-button') as HTMLElement
      button.click()

      await vi.waitFor(() => {
        expect(button.classList.contains('copied')).toBe(true)
      })

      await vi.advanceTimersByTimeAsync(2000)
      expect(button.classList.contains('copied')).toBe(false)

      vi.useRealTimers()
    })

    test('should replace old copy buttons when content updates', async () => {
      await loadMain()

      sendMarkdown('<pre><code>first</code></pre>')
      expect(document.querySelectorAll('.copy-button')).toHaveLength(1)

      sendMarkdown(
        '<pre><code>second</code></pre><pre><code>third</code></pre>',
      )
      expect(document.querySelectorAll('.copy-button')).toHaveLength(2)
    })

    test('should keep copy buttons enabled', async () => {
      await loadMain()

      sendMarkdown(
        '<pre><code>console.log("hi")</code></pre><button>Other</button>',
      )

      const copyButton =
        document.querySelector<HTMLButtonElement>('.copy-button')
      const otherButton = document.querySelector<HTMLButtonElement>(
        '#markdown-content button:not(.copy-button)',
      )

      expect(copyButton?.disabled).toBe(false)
      expect(copyButton?.getAttribute('aria-disabled')).toBeNull()
      expect(otherButton?.disabled).toBe(true)
    })
  })

  describe('https-only mode', () => {
    test('should block http:// links when data-https-only is set', async () => {
      document.body.setAttribute('data-https-only', '')
      await loadMain()

      sendMarkdown(
        '<a href="http://example.com">HTTP Link</a><a href="https://example.com">HTTPS Link</a>',
      )

      const links = document.querySelectorAll('a')
      const httpLink = links[0]!
      const httpsLink = links[1]!

      expect(httpLink.hasAttribute('href')).toBe(false)
      expect(httpLink.getAttribute('aria-disabled')).toBe('true')
      expect(httpsLink.getAttribute('href')).toBe('https://example.com')
    })

    test('should add target=_blank and rel=noopener noreferrer to all external links', async () => {
      document.body.setAttribute('data-https-only', '')
      await loadMain()

      sendMarkdown(
        '<a href="https://example.com">HTTPS</a><a href="http://example.com">HTTP</a>',
      )

      const links = document.querySelectorAll('a')
      const httpsLink = links[0]!
      expect(httpsLink.getAttribute('target')).toBe('_blank')
      expect(httpsLink.getAttribute('rel')).toBe('noopener noreferrer')

      const httpLink = links[1]!
      expect(httpLink.getAttribute('target')).toBe('_blank')
      expect(httpLink.getAttribute('rel')).toBe('noopener noreferrer')
    })

    test('should not add target=_blank to relative links', async () => {
      document.body.setAttribute('data-https-only', '')
      await loadMain()

      sendMarkdown(
        '<a href="#heading">Anchor</a><a href="./other.md">Relative</a>',
      )

      const links = document.querySelectorAll('a')
      for (const link of links) {
        expect(link.hasAttribute('target')).toBe(false)
      }
    })

    test('should remove http:// images', async () => {
      document.body.setAttribute('data-https-only', '')
      await loadMain()

      sendMarkdown(
        '<img src="http://example.com/img.png"><img src="https://example.com/img.png">',
      )

      const images = document.querySelectorAll('img')
      expect(images).toHaveLength(1)
      expect(images[0]!.getAttribute('src')).toBe('https://example.com/img.png')
    })

    test('should not block http links when data-https-only is not set', async () => {
      document.body.removeAttribute('data-https-only')
      await loadMain()

      sendMarkdown(
        '<a href="http://example.com">HTTP</a><a href="https://example.com">HTTPS</a>',
      )

      const links = document.querySelectorAll('a')
      expect(links[0]!.getAttribute('href')).toBe('http://example.com')
      expect(links[1]!.getAttribute('href')).toBe('https://example.com')
    })

    test('should still secure external links when data-https-only is not set', async () => {
      document.body.removeAttribute('data-https-only')
      await loadMain()

      sendMarkdown(
        '<a href="http://example.com">HTTP</a><a href="https://example.com">HTTPS</a>',
      )

      const links = document.querySelectorAll('a')
      for (const link of links) {
        expect(link.getAttribute('target')).toBe('_blank')
        expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      }
    })
  })

  describe('disconnected alert', () => {
    test('should be hidden initially', async () => {
      await loadMain()

      const alert = document.getElementById('disconnected-alert')
      expect(alert).toBeTruthy()
      expect(alert?.hidden).toBe(true)
    })

    test('should appear when connection is lost (onerror)', async () => {
      await loadMain()

      const alert = document.getElementById('disconnected-alert')
      expect(alert?.hidden).toBe(true)

      if (mockEventSource.onerror) {
        mockEventSource.onerror()
      }

      expect(alert?.hidden).toBe(false)
    })

    test('should disappear when client reconnects (onopen)', async () => {
      await loadMain()

      const alert = document.getElementById('disconnected-alert')

      if (mockEventSource.onerror) {
        mockEventSource.onerror()
      }
      expect(alert?.hidden).toBe(false)

      if (mockEventSource.onopen) {
        mockEventSource.onopen()
      }

      expect(alert?.hidden).toBe(true)
    })

    test('should hide alert when close button is clicked', async () => {
      await loadMain()

      const alert = document.getElementById('disconnected-alert')
      const closeButton = document.getElementById('alert-close')

      if (mockEventSource.onerror) {
        mockEventSource.onerror()
      }
      expect(alert?.hidden).toBe(false)

      closeButton?.click()

      expect(alert?.hidden).toBe(true)
    })
  })
})
