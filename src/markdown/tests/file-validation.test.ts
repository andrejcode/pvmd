import fs from 'node:fs'
import { config } from '../../cli/config'
import { validateMarkdownExtension, validateFile } from '../file-validation'

vi.mock('node:fs')

describe('validateMarkdownExtension', () => {
  const validExtensions = [
    '.md',
    '.markdown',
    '.mdown',
    '.mkdn',
    '.mkd',
    '.mdwn',
    '.mdtxt',
    '.mdtext',
  ]

  test('should throw an error if extension is not a markdown file', () => {
    expect(() => validateMarkdownExtension('test.js')).toThrow(
      `Invalid extension for path: test.js.\nExpected extensions: ${validExtensions.join(', ')}`,
    )
  })

  test.each(validExtensions)(
    'should not throw an error if extension is a markdown file',
    (extension) => {
      expect(() => validateMarkdownExtension(`test${extension}`)).not.toThrow()
    },
  )

  test('should handle case insensitive extensions', () => {
    expect(() => validateMarkdownExtension('test.MD')).not.toThrow()
  })

  test('should handle mixed case extensions', () => {
    expect(() => validateMarkdownExtension('test.Md')).not.toThrow()
  })
})

describe('validateFile', () => {
  const mockStats = (statsConfig: {
    isFile: boolean
    isDirectory: boolean
    isSymbolicLink: boolean
    size?: number // Size check can be disabled
  }) => {
    vi.mocked(fs.lstatSync).mockReturnValue({
      isDirectory: () => statsConfig.isDirectory,
      isFile: () => statsConfig.isFile,
      isSymbolicLink: () => statsConfig.isSymbolicLink,
      size: statsConfig.size ?? 0,
    } as fs.Stats)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    config.skipSizeCheck = false
    config.maxFileSizeMB = 2
  })

  afterEach(() => {
    config.skipSizeCheck = false
    config.maxFileSizeMB = 2
  })

  test('should throw an error if path is a directory', () => {
    mockStats({ isDirectory: true, isFile: false, isSymbolicLink: false })
    expect(() => validateFile('test.md')).toThrow(
      'Path is a directory: test.md',
    )
  })

  test('should throw an error if path is a symbolic link', () => {
    mockStats({ isDirectory: false, isFile: false, isSymbolicLink: true })
    expect(() => validateFile('test.md')).toThrow(
      `Path is a symbolic link: test.md`,
    )
  })

  test('should not throw an error if path is a file', () => {
    mockStats({ isDirectory: false, isFile: true, isSymbolicLink: false })
    expect(() => validateFile('test.md')).not.toThrow()
  })

  test('should throw an error if path is not a file', () => {
    mockStats({ isDirectory: false, isFile: false, isSymbolicLink: false })
    expect(() => validateFile('test.md')).toThrow(`Path is not a file: test.md`)
  })

  test('should throw an error when file does not exist', () => {
    const error = new Error(
      'ENOENT: no such file or directory',
    ) as NodeJS.ErrnoException
    error.code = 'ENOENT'

    vi.mocked(fs.lstatSync).mockImplementation(() => {
      throw error
    })

    expect(() => validateFile('nonexistent.md')).toThrow(
      'File not found: nonexistent.md',
    )
  })

  test('should not throw an error when file size is within limit', () => {
    const oneMB = 1024 * 1024
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: oneMB,
    })
    expect(() => validateFile('test.md')).not.toThrow()
  })

  test('should throw an error when file size exceeds limit', () => {
    const threeMB = 3 * 1024 * 1024
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: threeMB,
    })
    expect(() => validateFile('test.md')).toThrow(
      'File is too large: test.md. Maximum size is 2 MB',
    )
  })

  test('should not throw an error when file size is exactly at limit', () => {
    const exactlyTwoMB = 2 * 1024 * 1024
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: exactlyTwoMB,
    })
    expect(() => validateFile('test.md')).not.toThrow()
  })

  test('should throw an error when file size is just over limit', () => {
    const justOverTwoMB = 2 * 1024 * 1024 + 1
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: justOverTwoMB,
    })
    expect(() => validateFile('test.md')).toThrow(
      'File is too large: test.md. Maximum size is 2 MB',
    )
  })

  test('should not throw an error when skipSizeCheck is true', () => {
    config.skipSizeCheck = true
    const tenMB = 10 * 1024 * 1024
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: tenMB,
    })
    expect(() => validateFile('test.md')).not.toThrow()
  })

  test('should respect custom maxFileSizeMB setting', () => {
    config.maxFileSizeMB = 5
    const fourMB = 4 * 1024 * 1024
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: fourMB,
    })
    expect(() => validateFile('test.md')).not.toThrow()
  })

  test('should throw an error with custom maxFileSizeMB when exceeded', () => {
    config.maxFileSizeMB = 5
    const sixMB = 6 * 1024 * 1024
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: sixMB,
    })
    expect(() => validateFile('test.md')).toThrow(
      'File is too large: test.md. Maximum size is 5 MB',
    )
  })

  test('should handle very small files', () => {
    const oneKB = 1024
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: oneKB,
    })
    expect(() => validateFile('test.md')).not.toThrow()
  })

  test('should handle zero size files', () => {
    mockStats({
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      size: 0,
    })
    expect(() => validateFile('test.md')).not.toThrow()
  })
})
