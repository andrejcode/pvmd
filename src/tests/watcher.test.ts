import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MockInstance } from 'vitest'
import createWatcher from '../watcher'

// Mirrors the function-scoped debounceMs in createWatcher.
const WATCH_DEBOUNCE_MS = 200

const { watchMock, readFileSyncMock, parseMarkdownMock } = vi.hoisted(() => ({
  watchMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  parseMarkdownMock: vi.fn(),
}))

vi.mock('node:fs', () => ({
  watch: watchMock,
  readFileSync: readFileSyncMock,
}))

vi.mock('../markdown', () => ({
  parseMarkdown: parseMarkdownMock,
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
  let closeMock: ReturnType<typeof vi.fn>
  let processExitSpy: MockInstance
  let consoleErrorSpy: MockInstance

  beforeEach(() => {
    vi.useFakeTimers()

    closeMock = vi.fn()
    watchMock.mockImplementation((_path: string, callback: WatchCallback) => {
      watchCallback = callback
      return { close: closeMock }
    })

    readFileSyncMock.mockReturnValue('# Hello')
    parseMarkdownMock.mockReturnValue('<h1>Hello</h1>')

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
    readFileSyncMock.mockReset()
    parseMarkdownMock.mockReset()
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

    expect(readFileSyncMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS - 1)
    expect(readFileSyncMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(readFileSyncMock).toHaveBeenCalledTimes(1)
    expect(readFileSyncMock).toHaveBeenCalledWith('/tmp/file.md', 'utf-8')
    expect(parseMarkdownMock).toHaveBeenCalledTimes(1)
    expect(parseMarkdownMock).toHaveBeenCalledWith('# Hello')
    expect(client.write).toHaveBeenCalledWith('data: "<h1>Hello</h1>"\n\n')
  })

  test('does not schedule reloads when no clients are connected', () => {
    createWatcher('/tmp/file.md')

    watchCallback('change')
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS)

    expect(readFileSyncMock).not.toHaveBeenCalled()
    expect(parseMarkdownMock).not.toHaveBeenCalled()
  })

  test('rename closes the watcher and exits immediately', () => {
    createWatcher('/tmp/file.md')

    expect(() => watchCallback('rename')).toThrow('Process exited with code 1')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'File /tmp/file.md was renamed or deleted. Exiting.',
    )
    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(processExitSpy).toHaveBeenCalledWith(1)
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

    expect(readFileSyncMock).not.toHaveBeenCalled()
    expect(closeMock).toHaveBeenCalledTimes(1)
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

    expect(readFileSyncMock).not.toHaveBeenCalled()
    expect(client.write).not.toHaveBeenCalled()
  })
})
