import { processFileSystemError } from '../errors'

describe('processFileSystemError', () => {
  test('should return generic message for unknown error codes', () => {
    const error = new Error('Unknown error') as NodeJS.ErrnoException
    error.code = 'EUNKNOWN'

    const result = processFileSystemError(error, '/path/to/file')

    expect(result).toBe('Unable to read file: /path/to/file')
  })
})
