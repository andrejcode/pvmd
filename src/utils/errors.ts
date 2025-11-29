export class ValidationError extends Error {}

/**
 * Helper function to process file system errors and return user-friendly error messages
 */
export function processFileSystemError(error: unknown, path: string): string {
  let errorMessage = `Unable to read file: ${path}`

  if (error instanceof Error && 'code' in error) {
    const nodeError = error as NodeJS.ErrnoException
    switch (nodeError.code) {
      case 'ENOENT':
        errorMessage = `File not found: ${path}`
        break
      case 'EACCES':
        errorMessage = `Permission denied: ${path}`
        break
      case 'EISDIR':
        errorMessage = `Path is a directory: ${path}`
        break
      case 'ERR_INVALID_ARG_VALUE':
        errorMessage = `Path contains null bytes: ${path}`
        break
    }
  }

  return errorMessage
}
