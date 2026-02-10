import { resolve } from 'node:path'
import { resolvePath } from '../path-validation'

describe('resolvePath', () => {
  const baseDir = '/some/test/dir'

  test('should resolve path relative to the base directory', () => {
    expect(resolvePath('test.md', baseDir)).toBe(resolve(baseDir, 'test.md'))
  })

  test('should throw an error if path traversal is attempted', () => {
    expect(() => resolvePath('../../test.md', baseDir)).toThrow(
      `Path traversal are not allowed: ${resolve(baseDir, '../../test.md')}`,
    )
  })

  test('should use process.cwd() as default base directory', () => {
    expect(resolvePath('test.md')).toBe(resolve(process.cwd(), 'test.md'))
  })
})
