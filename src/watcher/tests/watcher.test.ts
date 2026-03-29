import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MockInstance } from 'vitest'
import createWatcher from '..'

// Mirrors the function-scoped debounceMs in createWatcher.
const WATCH_DEBOUNCE_MS = 200
const RENAME_RETRY_DELAY_MS = 50
const RENAME_RETRY_LIMIT = 10

const {
  watchMock,
  readMarkdownFileMock,
  renderMarkdownDocumentMock,
  validateMarkdownPathMock,
} = vi.hoisted(() => ({
  watchMock: vi.fn(),
  readMarkdownFileMock: vi.fn(),
  renderMarkdownDocumentMock: vi.fn(),
  validateMarkdownPathMock: vi.fn(),
}))

vi.mock('node:fs', () => ({
  watch: watchMock,
}))

vi.mock('../../markdown', () => ({
  readMarkdownFile: readMarkdownFileMock,
  renderMarkdownDocument: renderMarkdownDocumentMock,
  validateMarkdownPath: validateMarkdownPathMock,
}))

type WatchEvent = 'change' | 'rename'
type WatchCallback = (event: WatchEvent) => void

function createMockClient() {
  let closeHandler: (() => void) | undefined

  const client = {
    writableEnded: false,
    writeHead: vi.fn(),
    write: vi.fn(),
    end: vi.fn(function end(this: { writableEnded: boolean }) {
      this.writableEnded = true
    }),
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'close') {
        closeHandler = handler
      }
    }),
    triggerClose: () => closeHandler?.(),
  }

  return client
}

describe('createWatcher', () => {
  let watchCallback: WatchCallback
  let closeMocks: Array<ReturnType<typeof vi.fn>>
  let processExitSpy: MockInstance
  let consoleErrorSpy: MockInstance

  beforeEach(() => {
    vi.useFakeTimers()

    closeMocks = []
    watchMock.mockImplementation((_path: string, callback: WatchCallback) => {
      watchCallback = callback
      const closeMock = vi.fn()
      closeMocks.push(closeMock)
      return { close: closeMock }
    })

    readMarkdownFileMock.mockReturnValue('# Hello')
    renderMarkdownDocumentMock.mockReturnValue({
      blocks: [{ id: 'block-1', html: '<h1>Hello</h1>' }],
      html: '<div data-pvmd-block-id="block-1"><h1>Hello</h1></div>',
    })
    validateMarkdownPathMock.mockReturnValue(undefined)

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`)
    })
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    watchMock.mockReset()
    readMarkdownFileMock.mockReset()
    renderMarkdownDocumentMock.mockReset()
    validateMarkdownPathMock.mockReset()
  })

  test('debounces rapid change events into a single reload', () => {
    const watcher = createWatcher('/tmp/file.md')
    const client = createMockClient()

    watcher.handleSSE(
      {} as IncomingMessage,
      client as unknown as ServerResponse,
    )

    watchCallback('change')
    watchCallback('change')
    watchCallback('change')

    expect(readMarkdownFileMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS - 1)
    expect(readMarkdownFileMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(readMarkdownFileMock).toHaveBeenCalledTimes(1)
    expect(readMarkdownFileMock).toHaveBeenCalledWith('/tmp/file.md')
    expect(renderMarkdownDocumentMock).toHaveBeenCalledTimes(1)
    expect(renderMarkdownDocumentMock).toHaveBeenCalledWith('# Hello')
    expect(client.write).toHaveBeenCalledWith(
      'data: {"kind":"full","html":"<div data-pvmd-block-id=\\"block-1\\"><h1>Hello</h1></div>"}\n\n',
    )
  })

  test('sends patch operations after the first rendered document', () => {
    renderMarkdownDocumentMock
      .mockReturnValueOnce({
        blocks: [{ id: 'block-1', html: '<h1>Hello</h1>' }],
        html: '<div data-pvmd-block-id="block-1"><h1>Hello</h1></div>',
      })
      .mockReturnValueOnce({
        blocks: [{ id: 'block-2', html: '<h1>Hello world</h1>' }],
        html: '<div data-pvmd-block-id="block-2"><h1>Hello world</h1></div>',
      })

    const watcher = createWatcher('/tmp/file.md')
    const client = createMockClient()

    watcher.handleSSE(
      {} as IncomingMessage,
      client as unknown as ServerResponse,
    )

    watchCallback('change')
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)

    watchCallback('change')
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)

    expect(client.write).toHaveBeenNthCalledWith(
      2,
      'data: {"kind":"patch","ops":[{"type":"remove","blockId":"block-1"},{"type":"insert","html":"<div data-pvmd-block-id=\\"block-2\\"><h1>Hello world</h1></div>"}]}\n\n',
    )
  })

  test('does not schedule reloads when no clients are connected', () => {
    createWatcher('/tmp/file.md')

    watchCallback('change')
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)

    expect(readMarkdownFileMock).not.toHaveBeenCalled()
    expect(renderMarkdownDocumentMock).not.toHaveBeenCalled()
  })

  test('rename reattaches the watcher when the same path becomes valid again', () => {
    const watcher = createWatcher('/tmp/file.md')
    const client = createMockClient()

    watcher.handleSSE(
      {} as IncomingMessage,
      client as unknown as ServerResponse,
    )

    watchCallback('rename')

    expect(validateMarkdownPathMock).toHaveBeenCalledWith('/tmp/file.md')
    expect(watchMock).toHaveBeenCalledTimes(2)
    expect(closeMocks[0]).toHaveBeenCalledTimes(1)
    expect(processExitSpy).not.toHaveBeenCalled()

    watchCallback('change')
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)

    expect(readMarkdownFileMock).toHaveBeenCalledWith('/tmp/file.md')
    expect(client.write).toHaveBeenCalledTimes(1)
  })

  test('rename exits after retries when the original path no longer validates', () => {
    validateMarkdownPathMock.mockImplementation(() => {
      throw new Error('No such file or directory: /tmp/file.md')
    })

    createWatcher('/tmp/file.md')

    watchCallback('rename')

    expect(() =>
      vi.advanceTimersByTime(RENAME_RETRY_DELAY_MS * (RENAME_RETRY_LIMIT - 1)),
    ).toThrow('Process exited with code 1')
    expect(validateMarkdownPathMock).toHaveBeenCalledTimes(RENAME_RETRY_LIMIT)
    expect(closeMocks[0]).toHaveBeenCalledTimes(1)
    expect(processExitSpy).toHaveBeenCalledWith(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'No such file or directory: /tmp/file.md',
    )
  })

  test('cleanup cancels pending reloads and closes connected clients', () => {
    const watcher = createWatcher('/tmp/file.md')
    const client = createMockClient()

    watcher.handleSSE(
      {} as IncomingMessage,
      client as unknown as ServerResponse,
    )
    watchCallback('change')
    watcher.cleanup()

    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)

    expect(readMarkdownFileMock).not.toHaveBeenCalled()
    expect(closeMocks[0]).toHaveBeenCalledTimes(1)
    expect(client.end).toHaveBeenCalledTimes(1)
  })

  test('disconnect removes the client from future broadcasts', () => {
    const watcher = createWatcher('/tmp/file.md')
    const client = createMockClient()

    watcher.handleSSE(
      {} as IncomingMessage,
      client as unknown as ServerResponse,
    )
    client.triggerClose()

    watchCallback('change')
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)

    expect(readMarkdownFileMock).not.toHaveBeenCalled()
    expect(client.write).not.toHaveBeenCalled()
  })

  test('sends a full error update when markdown validation fails after startup', () => {
    readMarkdownFileMock.mockImplementationOnce(() => {
      throw new Error('File is too large: /tmp/file.md')
    })

    const watcher = createWatcher('/tmp/file.md')
    const client = createMockClient()

    watcher.handleSSE(
      {} as IncomingMessage,
      client as unknown as ServerResponse,
    )

    watchCallback('change')
    expect(() => vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)).toThrow(
      'Process exited with code 1',
    )

    expect(renderMarkdownDocumentMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'File is too large: /tmp/file.md',
    )
    expect(closeMocks[0]).toHaveBeenCalledTimes(1)
    expect(client.write).not.toHaveBeenCalled()
    expect(client.end).toHaveBeenCalledTimes(1)
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})
