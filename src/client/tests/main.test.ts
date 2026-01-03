import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('main', () => {
  let mockWebSocket: {
    onopen: (() => void) | null
    onclose: (() => void) | null
    onerror: (() => void) | null
    onmessage: ((event: MessageEvent) => void) | null
  }

  beforeEach(() => {
    document.body.innerHTML = ''

    const htmlPath = join(__dirname, '../index.html')
    const htmlContent = readFileSync(htmlPath, 'utf-8')
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')
    document.body.innerHTML = doc.body.innerHTML

    mockWebSocket = {
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    }

    // @ts-expect-error - Mocking WebSocket
    global.WebSocket = vi.fn(() => mockWebSocket)

    vi.resetModules()
  })

  describe('markdown content', () => {
    it('should update markdown content on message', async () => {
      await import('../main')

      const markdownContent = document.getElementById('markdown-content')
      const testHtml = '<h1>Test Content</h1>'

      if (mockWebSocket.onmessage) {
        const mockEvent = new MessageEvent('message', {
          data: testHtml,
        })
        mockWebSocket.onmessage(mockEvent)
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

    it('should appear when client is disconnected (onclose)', async () => {
      await import('../main')

      const alert = document.getElementById('disconnected-alert')
      expect(alert?.hidden).toBe(true)

      if (mockWebSocket.onclose) {
        mockWebSocket.onclose()
      }

      expect(alert?.hidden).toBe(false)
    })

    it('should appear when client encounters an error (onerror)', async () => {
      await import('../main')

      const alert = document.getElementById('disconnected-alert')
      expect(alert?.hidden).toBe(true)

      if (mockWebSocket.onerror) {
        mockWebSocket.onerror()
      }

      expect(alert?.hidden).toBe(false)
    })

    it('should disappear when client reconnects (onopen)', async () => {
      await import('../main')

      const alert = document.getElementById('disconnected-alert')

      if (mockWebSocket.onclose) {
        mockWebSocket.onclose()
      }
      expect(alert?.hidden).toBe(false)

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen()
      }

      expect(alert?.hidden).toBe(true)
    })

    it('should hide alert when close button is clicked', async () => {
      await import('../main')

      const alert = document.getElementById('disconnected-alert')
      const closeButton = document.getElementById('alert-close')

      if (mockWebSocket.onclose) {
        mockWebSocket.onclose()
      }
      expect(alert?.hidden).toBe(false)

      closeButton?.click()

      expect(alert?.hidden).toBe(true)
    })

    it('should handle reconnection hiding alert that was shown due to error', async () => {
      await import('../main')

      const alert = document.getElementById('disconnected-alert')

      if (mockWebSocket.onerror) {
        mockWebSocket.onerror()
      }
      expect(alert?.hidden).toBe(false)

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen()
      }

      expect(alert?.hidden).toBe(true)
    })
  })
})
