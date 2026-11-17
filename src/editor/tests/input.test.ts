import { PassThrough } from 'node:stream'
import { config, DEFAULT_CONFIG } from '../../cli/config'
import {
  MAX_EDITOR_MESSAGE_BYTES,
  parseEditorMessage,
  readEditorInput,
  type EditorMessage,
} from '../input'

describe('editor input', () => {
  beforeEach(() => Object.assign(config, DEFAULT_CONFIG))

  test('accepts unsaved and unnamed buffer initialization', () => {
    expect(
      parseEditorMessage(
        JSON.stringify({
          type: 'init',
          protocol: 1,
          revision: 1,
          content: '# New',
          path: '/missing/new.md',
        }),
      ),
    ).toMatchObject({ path: '/missing/new.md' })
    expect(
      parseEditorMessage(
        JSON.stringify({ type: 'init', protocol: 1, revision: 1, content: '' }),
      ),
    ).toMatchObject({ content: '' })
  })

  test.each([
    null,
    [],
    { type: 'other', revision: 1, content: '' },
    { type: 'update', revision: 0, content: '' },
    { type: 'update', revision: 1.5, content: '' },
    { type: 'update', revision: 1, content: null },
    { type: 'init', protocol: 2, revision: 1, content: '' },
    { type: 'init', protocol: 1, revision: 1, content: '', baseDir: 5 },
  ])('rejects invalid messages: %j', (value) => {
    expect(() => parseEditorMessage(JSON.stringify(value))).toThrow()
  })

  test('enforces content size in bytes and honors size overrides', () => {
    config.maxFileSize = 1
    const line = JSON.stringify({
      type: 'update',
      revision: 1,
      content: '\u00e9'.repeat(600),
    })
    expect(() => parseEditorMessage(line)).toThrow('exceeds 1 KB')
    config.skipSizeCheck = true
    expect(parseEditorMessage(line).revision).toBe(1)
  })

  test('handles chunked UTF-8, escaped newlines, and multiple messages', () => {
    const input = new PassThrough()
    const onMessage = vi.fn<(message: EditorMessage) => void>()
    const onError = vi.fn()
    const detach = readEditorInput(input, onMessage, onError, vi.fn())
    const message = { type: 'update', revision: 1, content: '# \u00e9\nHello' }
    const bytes = Buffer.from(
      `${JSON.stringify(message)}\n${JSON.stringify({ ...message, revision: 2 })}\n`,
    )
    for (const byte of bytes) input.write(Buffer.from([byte]))
    expect(onMessage.mock.calls.map(([value]) => value.revision)).toEqual([
      1, 2,
    ])
    expect(onMessage.mock.calls[0]?.[0].content).toBe(message.content)
    expect(onError).not.toHaveBeenCalled()
    detach()
    input.destroy()
  })

  test('recovers after malformed and oversized frames', () => {
    const input = new PassThrough()
    const onMessage = vi.fn()
    const onError = vi.fn()
    const detach = readEditorInput(input, onMessage, onError, vi.fn())
    input.write('invalid\n')
    input.write(Buffer.alloc(MAX_EDITOR_MESSAGE_BYTES + 1, 32))
    input.write(
      `\n${JSON.stringify({ type: 'update', revision: 3, content: '' })}\n`,
    )
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onMessage).toHaveBeenCalledTimes(1)
    detach()
    input.destroy()
  })

  test('reports incomplete frames and shuts down at EOF', async () => {
    const input = new PassThrough()
    const onError = vi.fn()
    const onEnd = vi.fn()
    readEditorInput(input, vi.fn(), onError, onEnd)
    input.end('{')
    await new Promise<void>((resolve) => input.on('end', resolve))
    expect(onError).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()
  })
})
