import fs from 'node:fs'
import { resolve } from 'node:path'
import {
  validateMarkdownExtension,
  MD_FILE_EXTENSIONS,
  validateFile,
  resolvePath,
} from '../validation'

vi.mock('node:fs')

describe('validateMarkdownExtension', () => {
  test('should throw error if extension is not a markdown file', () => {
    expect(() => validateMarkdownExtension('test.js')).toThrow(
      `Invalid extension for path: test.js.\nExpected extensions: ${MD_FILE_EXTENSIONS.join(', ')}`,
    )
  })

  test.each(MD_FILE_EXTENSIONS)(
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

describe('resolvePath', () => {
  const baseDir = '/some/test/dir'

  test('should resolve path relative to the base directory', () => {
    expect(resolvePath('test.md', baseDir)).toBe(resolve(baseDir, 'test.md'))
  })

  test('should throw error if path traversal is attempted', () => {
    expect(() => resolvePath('../../test.md', baseDir)).toThrow(
      `Path traversal are not allowed: ${resolve(baseDir, '../../test.md')}`,
    )
  })

  test('should use process.cwd() as default base directory', () => {
    expect(resolvePath('test.md')).toBe(resolve(process.cwd(), 'test.md'))
  })
})
