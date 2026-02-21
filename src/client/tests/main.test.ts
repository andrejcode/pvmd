describe('main', () => {
  let mockEventSource: {
    onopen: (() => void) | null
    onerror: (() => void) | null
    onmessage: ((event: MessageEvent) => void) | null
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="disconnected-alert" hidden>
        <span id="alert-message">Connection lost. Waiting to reconnect...</span>
        <button id="alert-close" aria-label="Close alert"></button>
      </div>
      <main id="markdown-content" role="article" aria-live="polite" aria-atomic="false" aria-label="Markdown content"></main>
    `

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
