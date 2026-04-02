import { type MockInstance } from 'vitest'
import { config, DEFAULT_CONFIG } from '@/cli/config'
import openPreviewInBrowser from '../open-browser'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(
    (
      _command: string,
      _args: string[],
      callback: (error: Error | null) => void,
    ) => {
      callback(null)
    },
  ),
}))

vi.mock('open', () => ({
  default: vi.fn(() => Promise.resolve()),
  apps: {
    browser: 'browser',
    chrome: 'google chrome',
    firefox: 'firefox',
    edge: 'microsoft edge',
    brave: 'brave browser',
  },
}))

describe('openPreviewInBrowser', () => {
  let warnSpy: MockInstance

  beforeEach(() => {
    Object.assign(config, DEFAULT_CONFIG)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  test('warns without repeating the URL when browser auto-open fails', async () => {
    const open = (await import('open')).default as ReturnType<typeof vi.fn>
    open.mockClear()
    open.mockRejectedValueOnce(new Error('launch failed'))

    await openPreviewInBrowser('http://127.0.0.1:3000/')

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to open the default browser automatically. Use the preview address above to open it manually.',
    )
  })

  test('uses open without an explicit app for the default browser', async () => {
    const open = (await import('open')).default as ReturnType<typeof vi.fn>
    open.mockClear()

    config.browser = 'default'

    await openPreviewInBrowser('http://127.0.0.1:3000/')

    expect(open).toHaveBeenCalledWith('http://127.0.0.1:3000/')
  })

  test('warns when the selected browser is not installed', async () => {
    const { execFile } = await import('node:child_process')
    const execFileMock = execFile as unknown as ReturnType<typeof vi.fn>
    const open = (await import('open')).default as ReturnType<typeof vi.fn>

    config.browser = 'brave'
    open.mockClear()
    execFileMock.mockImplementationOnce(
      (
        _command: string,
        _args: string[],
        callback: (error: Error | null) => void,
      ) => {
        callback(new Error('not found'))
      },
    )

    await openPreviewInBrowser('http://127.0.0.1:3000/')

    expect(open).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      'The selected browser "brave" is not installed or is not available on this system. Use the preview address above to open it manually.',
    )
  })

  test('passes the selected browser app to open', async () => {
    const open = (await import('open')).default as ReturnType<typeof vi.fn>
    open.mockClear()
    config.browser = 'chrome'

    await openPreviewInBrowser('http://127.0.0.1:3000/')

    expect(open).toHaveBeenCalledWith('http://127.0.0.1:3000/', {
      app: { name: 'google chrome' },
    })
  })
})
