import fs from 'node:fs'
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

  test('should throw error if extension is not a markdown file', () => {
    expect(() => validateMarkdownExtension('test.js')).toThrow(
      `Invalid extension for path: test.js.\nExpected extensions: ${validExtensions.join(', ')}`,
    )
  })

  test.each(validExtensions)(
    'should not throw error if extension is a markdown file',
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
  const mockStats = (config: {
    isFile: boolean
    isDirectory: boolean
    isSymbolicLink: boolean
  }) => {
    vi.mocked(fs.lstatSync).mockReturnValue({
      isDirectory: () => config.isDirectory,
      isFile: () => config.isFile,
      isSymbolicLink: () => config.isSymbolicLink,
    } as fs.Stats)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should throw error if path is a directory', () => {
    mockStats({ isDirectory: true, isFile: false, isSymbolicLink: false })
    expect(() => validateFile('test.md')).toThrow(
      'Path is a directory: test.md',
    )
  })

  test('should throw error if path is a symbolic link', () => {
    mockStats({ isDirectory: false, isFile: false, isSymbolicLink: true })
    expect(() => validateFile('test.md')).toThrow(
      `Path is a symbolic link: test.md`,
    )
  })

  test('should not throw error if path is a file', () => {
    mockStats({ isDirectory: false, isFile: true, isSymbolicLink: false })
    expect(() => validateFile('test.md')).not.toThrow()
  })

  test('should throw error if path is not a file', () => {
    mockStats({ isDirectory: false, isFile: false, isSymbolicLink: false })
    expect(() => validateFile('test.md')).toThrow(`Path is not a file: test.md`)
  })

  test('should throw error when file does not exist', () => {
    const error = new Error(
      'ENOENT: no such file or directory',
    ) as NodeJS.ErrnoException
    error.code = 'ENOENT'

    vi.mocked(fs.lstatSync).mockImplementation(() => {
      throw error
    })

    expect(() => validateFile('nonexistent.md')).toThrow('ENOENT')
  })
})
