import { run } from '../app'
import { config, DEFAULT_CONFIG } from '../cli/config'
import {
  readMarkdownFile,
  renderBlocksHtml,
  renderMarkdownBlocks,
  validateMarkdownPath,
} from '../markdown'
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

    expect(prepareHTML).toHaveBeenCalledWith(
      '/tmp/readme.md',
      '<h1>Hello</h1>',
      'dark-colorblind',
    )
  })
})
