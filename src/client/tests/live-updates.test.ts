import { type LiveUpdateOperation } from '@/shared/live-update'

describe('live updates', () => {
  const ALERT_HTML = `
    <div id="disconnected-alert" hidden>
      <span id="alert-message">Connection lost. Waiting to reconnect...</span>
      <button id="alert-close" type="button" aria-label="Close alert">
        <i data-lucide="x"></i>
      </button>
    </div>
  `

  let mockEventSource: {
    onopen: (() => void) | null
    onerror: (() => void) | null
    onmessage: ((event: MessageEvent) => void) | null
  }
  let onFullHtml: ReturnType<typeof vi.fn<(html: string) => void>>
  let onPatch: ReturnType<typeof vi.fn<(ops: LiveUpdateOperation[]) => void>>

  async function loadLiveUpdates() {
    return import('../live-updates')
  }

  function connectOptions() {
    return {
      enabled: true,
      onFullHtml,
      onPatch,
    }
  }

  function sendMessage(data: unknown) {
    mockEventSource.onmessage?.(new MessageEvent('message', { data }))
  }

  beforeEach(() => {
    document.body.innerHTML = ALERT_HTML
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
    onFullHtml = vi.fn()
    onPatch = vi.fn()
    vi.resetModules()
  })

  test('creates an EventSource when enabled', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()

    const result = connectLiveUpdates(connectOptions())

    expect(globalThis.EventSource).toHaveBeenCalledWith('/events')
    expect(result).toBe(mockEventSource)
  })

  test('does not create an EventSource when disabled', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()

    const result = connectLiveUpdates({
      ...connectOptions(),
      enabled: false,
    })

    expect(globalThis.EventSource).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  test('uses a custom event URL when provided', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()

    connectLiveUpdates({
      ...connectOptions(),
      url: '/custom-events',
    })

    expect(globalThis.EventSource).toHaveBeenCalledWith('/custom-events')
  })

  test('dispatches legacy string messages as full HTML updates', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()
    connectLiveUpdates(connectOptions())

    sendMessage(JSON.stringify('<h1>Test Content</h1>'))

    expect(onFullHtml).toHaveBeenCalledWith('<h1>Test Content</h1>')
    expect(onPatch).not.toHaveBeenCalled()
  })

  test('dispatches structured full messages as full HTML updates', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()
    connectLiveUpdates(connectOptions())

    sendMessage(JSON.stringify({ kind: 'full', html: '<h1>Updated</h1>' }))

    expect(onFullHtml).toHaveBeenCalledWith('<h1>Updated</h1>')
    expect(onPatch).not.toHaveBeenCalled()
  })

  test('dispatches patch messages as patch updates', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()
    const ops = [
      {
        type: 'insert',
        html: '<div data-pvmd-block-id="block-1"><p>Inserted</p></div>',
      },
    ]
    connectLiveUpdates(connectOptions())

    sendMessage(JSON.stringify({ kind: 'patch', ops }))

    expect(onPatch).toHaveBeenCalledWith(ops)
    expect(onFullHtml).not.toHaveBeenCalled()
  })

  test('ignores non-string message data', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()
    connectLiveUpdates(connectOptions())

    sendMessage({ kind: 'full', html: '<h1>Ignored</h1>' })

    expect(onFullHtml).not.toHaveBeenCalled()
    expect(onPatch).not.toHaveBeenCalled()
  })

  test('updates the disconnected alert from connection events', async () => {
    const { connectLiveUpdates } = await loadLiveUpdates()
    connectLiveUpdates(connectOptions())
    const alert = document.getElementById('disconnected-alert')

    mockEventSource.onerror?.()
    expect(alert?.hidden).toBe(false)

    mockEventSource.onopen?.()
    expect(alert?.hidden).toBe(true)
  })
})
