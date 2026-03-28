import { run } from '../app'
import { validateMarkdownPath } from '../markdown'
import { createServer, startServer } from '../server'
import { resolvePath } from '../utils/path-validation'
import createWatcher from '../watcher'

vi.mock('../markdown', () => ({
  validateMarkdownPath: vi.fn(),
  readMarkdownFile: vi.fn(),
  renderMarkdownDocument: vi.fn(),
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
})
