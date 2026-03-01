describe('main', () => {
  let mockEventSource: {
    onopen: (() => void) | null
    onerror: (() => void) | null
    onmessage: ((event: MessageEvent) => void) | null
  }
  let mockWriteText: ReturnType<typeof vi.fn<() => Promise<void>>>

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="disconnected-alert" hidden>
        <span id="alert-message">Connection lost. Waiting to reconnect...</span>
        <button id="alert-close" aria-label="Close alert"></button>
      </div>
      <main id="markdown-content" role="article" aria-live="polite" aria-atomic="false" aria-label="Markdown content"></main>
      <template id="icon-copy"><svg data-testid="copy-icon"></svg></template>
    `

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
    it('should update markdown content on message', async () => {
      await import('../main')

      const markdownContent = document.getElementById('markdown-content')
      const testHtml = '<h1>Test Content</h1>'

      if (mockEventSource.onmessage) {
        const mockEvent = new MessageEvent('message', {
          data: JSON.stringify(testHtml),
        })
        mockEventSource.onmessage(mockEvent)
      }

      expect(markdownContent?.innerHTML).toBe(testHtml)
    })
  })

  describe('copy buttons', () => {
    function sendMarkdown(html: string) {
      if (mockEventSource.onmessage) {
        mockEventSource.onmessage(
          new MessageEvent('message', { data: JSON.stringify(html) }),
        )
      }
    }

    it('should add a copy button to each code block', async () => {
      await import('../main')

      sendMarkdown(
        '<pre><code>const a = 1</code></pre><pre><code>const b = 2</code></pre>',
      )

      const buttons = document.querySelectorAll('.copy-button')
      expect(buttons).toHaveLength(2)
      buttons.forEach((btn) => {
        expect(btn.getAttribute('aria-label')).toBe('Copy code')
      })
    })

    it('should not add copy buttons when there are no code blocks', async () => {
      await import('../main')

      sendMarkdown('<p>No code here</p>')

      expect(document.querySelectorAll('.copy-button')).toHaveLength(0)
    })

    it('should clone the icon template into each button', async () => {
      await import('../main')

      sendMarkdown('<pre><code>hello</code></pre>')

      const button = document.querySelector('.copy-button')
      const svg = button?.querySelector('svg')
      expect(svg).toBeTruthy()
    })

    it('should copy code text to clipboard on click', async () => {
      await import('../main')

      sendMarkdown('<pre><code>console.log("hi")</code></pre>')

      const button = document.querySelector('.copy-button') as HTMLElement
      button.click()

      expect(mockWriteText).toHaveBeenCalledWith('console.log("hi")')
    })

    it('should add and remove the "copied" class as feedback', async () => {
      vi.useFakeTimers()
      await import('../main')

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

    it('should replace old copy buttons when content updates', async () => {
      await import('../main')

      sendMarkdown('<pre><code>first</code></pre>')
      expect(document.querySelectorAll('.copy-button')).toHaveLength(1)

      sendMarkdown(
        '<pre><code>second</code></pre><pre><code>third</code></pre>',
      )
      expect(document.querySelectorAll('.copy-button')).toHaveLength(2)
    })
  })

  describe('disconnected alert', () => {
    it('should be hidden initially', async () => {
      await import('../main')

      const alert = document.getElementById('disconnected-alert')
      expect(alert).toBeTruthy()
      expect(alert?.hidden).toBe(true)
    })

    it('should appear when connection is lost (onerror)', async () => {
      await import('../main')

      const alert = document.getElementById('disconnected-alert')
      expect(alert?.hidden).toBe(true)

      if (mockEventSource.onerror) {
        mockEventSource.onerror()
      }

      expect(alert?.hidden).toBe(false)
    })

    it('should disappear when client reconnects (onopen)', async () => {
      await import('../main')

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

    it('should hide alert when close button is clicked', async () => {
      await import('../main')

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
