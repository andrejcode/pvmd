import { run } from '../app'
import { config, DEFAULT_CONFIG } from '../cli/config'
import {
  readMarkdownFile,
  renderBlocksHtml,
  renderMarkdownBlocks,
  validateMarkdownPath,
} from '../markdown'
import { isLargerThanDefaultMaxFileSize } from '../markdown/file-validation'
import { createServer, startServer } from '../server'
import { prepareHTML } from '../template'
import { resolvePath } from '../utils/path-validation'
import createWatcher from '../watcher'

vi.mock('../markdown', () => ({
  validateMarkdownPath: vi.fn(),
  readMarkdownFile: vi.fn(),
  renderMarkdownBlocks: vi.fn(),
  renderBlocksHtml: vi.fn(),
}))

vi.mock('../markdown/file-validation', () => ({
  isLargerThanDefaultMaxFileSize: vi.fn(),
}))

vi.mock('../server', () => ({
  createServer: vi.fn(),
  startServer: vi.fn(),
}))

vi.mock('../template', () => ({
  prepareHTML: vi.fn(),
}))

vi.mock('../utils/path-validation', () => ({
  resolvePath: vi.fn(),
}))

vi.mock('../watcher', () => ({
  default: vi.fn(),
}))

describe('run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(config, DEFAULT_CONFIG)
    vi.mocked(resolvePath).mockReturnValue('/tmp/readme.md')
    vi.mocked(isLargerThanDefaultMaxFileSize).mockReturnValue(false)
  })

  test('validates markdown path before creating watcher or server', () => {
    vi.mocked(validateMarkdownPath).mockImplementation(() => {
      throw new Error('File is too large')
    })

    expect(() => run('README.md')).toThrow('File is too large')

    expect(resolvePath).toHaveBeenCalledWith('README.md')
    expect(validateMarkdownPath).toHaveBeenCalledWith('/tmp/readme.md')
    expect(createWatcher).not.toHaveBeenCalled()
    expect(createServer).not.toHaveBeenCalled()
    expect(startServer).not.toHaveBeenCalled()
  })

  test('passes the configured theme to prepareHTML', () => {
    config.theme = 'dark-colorblind'
    config.httpsOnly = true

    vi.mocked(validateMarkdownPath).mockReturnValue(undefined)
    vi.mocked(createWatcher).mockReturnValue({
      cleanup: vi.fn(),
      handleSSE: vi.fn(),
    })
    vi.mocked(readMarkdownFile).mockReturnValue('# Hello')
    vi.mocked(renderMarkdownBlocks).mockReturnValue([])
    vi.mocked(renderBlocksHtml).mockReturnValue('<h1>Hello</h1>')
    vi.mocked(createServer).mockImplementation((getHTML) => {
      getHTML()
      return {} as never
    })

    run('README.md')

    expect(createWatcher).toHaveBeenCalledWith('/tmp/readme.md', true)
    expect(renderMarkdownBlocks).toHaveBeenCalledWith('# Hello', true)
    expect(prepareHTML).toHaveBeenCalledWith(
      '/tmp/readme.md',
      '<h1>Hello</h1>',
      'dark-colorblind',
    )
  })

  test('disables watch for files larger than the default max size', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    config.skipSizeCheck = true
    config.maxFileSize = 2048
    vi.mocked(validateMarkdownPath).mockReturnValue(undefined)
    vi.mocked(isLargerThanDefaultMaxFileSize).mockReturnValue(true)
    vi.mocked(createServer).mockReturnValue({} as never)

    try {
      run('README.md')

      expect(validateMarkdownPath).toHaveBeenCalledWith('/tmp/readme.md')
      expect(isLargerThanDefaultMaxFileSize).toHaveBeenCalledWith(
        '/tmp/readme.md',
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Large markdown file detected (over 512 KB). File watching is disabled for this preview, and the first browser render may take longer.',
      )
      expect(createWatcher).not.toHaveBeenCalled()
      expect(createServer).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        '/tmp',
      )
      expect(startServer).toHaveBeenCalled()
    } finally {
      consoleLogSpy.mockRestore()
    }
  })
})
