import fs from 'node:fs'
import { validateFile } from '@/markdown/file-validation'
import { resolvePath } from '../path-validation'
import { resolveStaticFile } from '../static-file'

vi.mock('node:fs')
vi.mock('../path-validation')
vi.mock('@/markdown/file-validation')

const BASE_DIR = '/project'
const FAKE_DATA = Buffer.from('fake image data')

describe('resolveStaticFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolvePath).mockImplementation(
      (userPath) => `${BASE_DIR}/${userPath}`,
    )
    vi.mocked(validateFile).mockImplementation(() => {})
    vi.mocked(fs.readFileSync).mockReturnValue(FAKE_DATA)
  })

  const supportedExtensions = [
    ['.avif', 'image/avif'],
    ['.gif', 'image/gif'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webp', 'image/webp'],
  ] as const

  test.each(supportedExtensions)(
    'should accept %s and return content-type %s',
    (ext, expectedMime) => {
      const result = resolveStaticFile(`image${ext}`, BASE_DIR)
      expect(result.contentType).toBe(expectedMime)
      expect(result.headers['content-type']).toBe(expectedMime)
    },
  )

  const unsupportedExtensions = [
    '.js',
    '.html',
    '.css',
    '.txt',
    '.md',
    '.json',
    '.ts',
    '.exe',
    '.sh',
    '.env',
  ]

  test.each(unsupportedExtensions)('should reject %s extension', (ext) => {
    expect(() => resolveStaticFile(`file${ext}`, BASE_DIR)).toThrow(
      `Unsupported file type: ${ext}`,
    )
  })

  test('should reject path with no extension', () => {
    expect(() => resolveStaticFile('Makefile', BASE_DIR)).toThrow(
      'Unsupported file type: (none)',
    )
  })

  test('should handle case insensitive extensions', () => {
    expect(() => resolveStaticFile('photo.JPG', BASE_DIR)).not.toThrow()
    expect(() => resolveStaticFile('photo.Png', BASE_DIR)).not.toThrow()
    expect(() => resolveStaticFile('icon.SVG', BASE_DIR)).not.toThrow()
  })

  test('should call resolvePath with relativePath and baseDir', () => {
    resolveStaticFile('images/photo.png', BASE_DIR)
    expect(resolvePath).toHaveBeenCalledWith('images/photo.png', BASE_DIR)
  })

  test('should call validateFile with the resolved path', () => {
    resolveStaticFile('photo.png', BASE_DIR)
    expect(validateFile).toHaveBeenCalledWith(`${BASE_DIR}/photo.png`)
  })

  test('should return file data from readFileSync', () => {
    const result = resolveStaticFile('photo.png', BASE_DIR)
    expect(result.data).toBe(FAKE_DATA)
    expect(fs.readFileSync).toHaveBeenCalledWith(`${BASE_DIR}/photo.png`)
  })

  test('should include cache-control and x-content-type-options headers', () => {
    const result = resolveStaticFile('photo.png', BASE_DIR)
    expect(result.headers['cache-control']).toBe('no-cache')
    expect(result.headers['x-content-type-options']).toBe('nosniff')
  })

  test('should include restrictive CSP header for SVG files', () => {
    const result = resolveStaticFile('icon.svg', BASE_DIR)
    expect(result.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'",
    )
  })

  test('should not include CSP header for non-SVG images', () => {
    for (const ext of [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.avif',
      '.ico',
    ]) {
      const result = resolveStaticFile(`image${ext}`, BASE_DIR)
      expect(result.headers['content-security-policy']).toBeUndefined()
    }
  })

  test('should propagate path traversal errors from resolvePath', () => {
    vi.mocked(resolvePath).mockImplementation(() => {
      throw new Error('Path traversal are not allowed: /etc/passwd')
    })
    expect(() => resolveStaticFile('../../etc/passwd.png', BASE_DIR)).toThrow(
      'Path traversal are not allowed',
    )
  })

  test('should propagate symlink errors from validateFile', () => {
    vi.mocked(validateFile).mockImplementation(() => {
      throw new Error('Path is a symbolic link: /project/link.png')
    })
    expect(() => resolveStaticFile('link.png', BASE_DIR)).toThrow(
      'Path is a symbolic link',
    )
  })

  test('should propagate file-not-found errors from validateFile', () => {
    vi.mocked(validateFile).mockImplementation(() => {
      throw new Error('File not found: /project/missing.png')
    })
    expect(() => resolveStaticFile('missing.png', BASE_DIR)).toThrow(
      'File not found',
    )
  })

  test('should propagate readFileSync errors', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })
    expect(() => resolveStaticFile('photo.png', BASE_DIR)).toThrow(
      'EACCES: permission denied',
    )
  })

  test('should check extension before hitting the filesystem', () => {
    expect(() => resolveStaticFile('data.json', BASE_DIR)).toThrow(
      'Unsupported file type',
    )
    expect(resolvePath).not.toHaveBeenCalled()
    expect(validateFile).not.toHaveBeenCalled()
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })
})
