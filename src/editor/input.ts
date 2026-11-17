import type { Readable } from 'node:stream'
import { config } from '../cli/config'

export const EDITOR_PROTOCOL_VERSION = 1
export const MAX_EDITOR_MESSAGE_BYTES = 16 * 1024 * 1024

export interface EditorMessage {
  type: 'init' | 'update'
  revision: number
  content: string
  protocol?: number
  path?: string
  baseDir?: string
}

export function parseEditorMessage(line: string): EditorMessage {
  const value: unknown = JSON.parse(line)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an editor message object')
  }
  const message = value as Record<string, unknown>
  if (
    (message['type'] !== 'init' && message['type'] !== 'update') ||
    !Number.isSafeInteger(message['revision']) ||
    (message['revision'] as number) < 1 ||
    typeof message['content'] !== 'string'
  ) {
    throw new Error(
      'Expected init or update with a positive revision and Markdown content',
    )
  }
  if (message['type'] === 'init') {
    if (message['protocol'] !== EDITOR_PROTOCOL_VERSION) {
      throw new Error(
        `Unsupported editor protocol. Expected ${EDITOR_PROTOCOL_VERSION}`,
      )
    }
    for (const key of ['path', 'baseDir']) {
      if (
        message[key] !== undefined &&
        (typeof message[key] !== 'string' || message[key].includes('\0'))
      ) {
        throw new Error(`Invalid editor ${key}`)
      }
    }
  }
  if (
    !config.skipSizeCheck &&
    Buffer.byteLength(message['content']) > config.maxFileSize * 1024
  ) {
    throw new Error(
      `Markdown buffer exceeds ${config.maxFileSize} KB. Increase --max-size or use --no-size-check`,
    )
  }
  return message as unknown as EditorMessage
}

export function readEditorInput(
  input: Readable,
  onMessage: (message: EditorMessage) => void,
  onError: (error: unknown) => void,
  onEnd: () => void,
) {
  let chunks: Buffer[] = []
  let bytes = 0
  let discarding = false

  function onData(chunk: Buffer | string) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    let offset = 0
    while (offset < data.length) {
      const newline = data.indexOf(10, offset)
      const end = newline === -1 ? data.length : newline
      const part = data.subarray(offset, end)
      if (!discarding) {
        bytes += part.length
        if (bytes > MAX_EDITOR_MESSAGE_BYTES) {
          chunks = []
          discarding = true
          onError(
            new Error('Editor message exceeds the 16 MiB transport limit'),
          )
        } else {
          chunks.push(part)
        }
      }
      if (newline !== -1) {
        if (!discarding && bytes > 0) {
          try {
            onMessage(
              parseEditorMessage(Buffer.concat(chunks, bytes).toString('utf8')),
            )
          } catch (error) {
            onError(error)
          }
        }
        chunks = []
        bytes = 0
        discarding = false
      }
      offset = end + 1
    }
  }

  function onStreamEnd() {
    if (bytes && !discarding)
      onError(new Error('Incomplete editor message at EOF'))
    onEnd()
  }

  function onStreamError(error: Error) {
    onError(error)
    onEnd()
  }

  input.on('data', onData)
  input.on('end', onStreamEnd)
  input.on('error', onStreamError)
  return () => {
    input.off('data', onData)
    input.off('end', onStreamEnd)
    input.off('error', onStreamError)
  }
}
