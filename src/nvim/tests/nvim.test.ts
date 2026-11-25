import { PassThrough } from 'node:stream'
import type { ReadableStreamDefaultReader } from 'node:stream/web'
import { runNeovim } from '..'
import { config, DEFAULT_CONFIG } from '../../cli/config'

vi.mock('../../template', () => ({
  prepareHTML: (path: string, html: string) =>
    `<body><title>${path}</title><main>${html}</main></body>`,
}))

describe('Neovim preview session', () => {
  let input: PassThrough
  let send: ReturnType<
    typeof vi.fn<(message: { type?: string; url?: string }) => void>
  >
  let cleanup: () => void

  beforeEach(() => {
    Object.assign(config, DEFAULT_CONFIG, {
      port: 0,
      open: false,
      watch: false,
    })
    input = new PassThrough()
    send = vi.fn()
    cleanup = runNeovim(input, send)
  })

  afterEach(() => {
    cleanup()
    input.destroy()
  })

  function write(message: object) {
    input.write(`${JSON.stringify(message)}\n`)
  }

  async function initialize(content = '# Unsaved', line?: number) {
    write({
      type: 'init',
      protocol: 1,
      revision: 1,
      content,
      path: '/missing/notes.md',
      baseDir: '/tmp',
      line,
    })
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ready', protocol: 1 }),
      ),
    )
    return send.mock.calls.find(([message]) => message.type === 'ready')![0]
      .url as string
  }

  test('serves the newest unsaved content and ignores stale revisions', async () => {
    const url = await initialize()
    expect(await (await fetch(url)).text()).toContain('Unsaved')
    write({ type: 'update', revision: 3, content: '# Latest' })
    write({ type: 'update', revision: 2, content: '# Stale' })
    const html = await (await fetch(url)).text()
    expect(html).toContain('Latest')
    expect(html).not.toContain('Stale')
    expect(send).toHaveBeenCalledWith({
      type: 'applied',
      revision: 2,
      stale: true,
    })
  })

  test('sends full snapshots on connection and reconnection, then patches', async () => {
    const url = await initialize()
    const response = await fetch(`${url}events`)
    const reader =
      response.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>
    try {
      const first = new TextDecoder().decode((await reader.read()).value)
      expect(first).toContain('"kind":"full"')
      expect(first).toContain('Unsaved')
      write({ type: 'update', revision: 2, content: '# Changed' })
      const patch = new TextDecoder().decode((await reader.read()).value)
      expect(patch).toContain('"kind":"patch"')
      expect(patch).toContain('Changed')
      const reconnect = await fetch(`${url}events`)
      const newReader =
        reconnect.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>
      try {
        const snapshot = new TextDecoder().decode(
          (await newReader.read()).value,
        )
        expect(snapshot).toContain('"kind":"full"')
        expect(snapshot).toContain('Changed')
      } finally {
        await newReader.cancel()
      }
    } finally {
      await reader.cancel()
    }
  })

  test('supports unnamed buffers, rejects invalid session transitions, and keeps running', async () => {
    write({ type: 'update', revision: 1, content: '' })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Send init before updating the document',
      }),
    )
    write({
      type: 'init',
      protocol: 1,
      revision: 1,
      content: '',
      baseDir: '/tmp',
    })
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ready' }),
      ),
    )
    write({ type: 'init', protocol: 1, revision: 2, content: '' })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Neovim session is already initialized',
      }),
    )
  })

  test('synchronizes viewport-only changes and restores them on reconnect', async () => {
    const url = await initialize('# First\n\nParagraph\ncontinued\n\n# Last', 3)
    const response = await fetch(`${url}events`)
    const reader =
      response.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>
    const decoder = new TextDecoder()
    try {
      const initial = decoder.decode((await reader.read()).value)
      expect(initial).toContain('"kind":"full"')
      expect(initial).toContain('"kind":"scroll"')
      expect(initial).toContain('"progress":0')
      write({ type: 'scroll', revision: 1, line: 4 })
      const scroll = decoder.decode((await reader.read()).value)
      expect(scroll).toContain('"kind":"scroll"')
      expect(scroll).toContain('"progress":0.5')
      expect(scroll).not.toContain('"kind":"patch"')
      write({ type: 'scroll', revision: 99, line: 1 })
      const reconnect = await fetch(`${url}events`)
      const nextReader =
        reconnect.body!.getReader() as ReadableStreamDefaultReader<Uint8Array>
      try {
        const snapshot = decoder.decode((await nextReader.read()).value)
        expect(snapshot).toContain('"progress":0.5')
      } finally {
        await nextReader.cancel()
      }
      write({
        type: 'update',
        revision: 2,
        content: '\n\n# First\n\nParagraph\ncontinued\n\n# Last',
        line: 5,
      })
      const shifted = decoder.decode((await reader.read()).value)
      expect(shifted).toContain('"kind":"scroll"')
      expect(shifted).toContain('"progress":0')
      expect(shifted).not.toContain('"kind":"patch"')
    } finally {
      await reader.cancel()
    }
  })

  test('ends SSE clients and detaches the input at EOF', async () => {
    const url = await initialize()
    const response = await fetch(`${url}events`)
    const reader = response.body!.getReader()
    await reader.read()
    input.end()
    await new Promise<void>((resolve) => input.on('end', resolve))
    expect(input.listenerCount('data')).toBe(0)
    await expect(reader.read()).resolves.toMatchObject({ done: true })
  })
})
