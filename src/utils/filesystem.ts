/**
 * Helper function to process file system errors and return user-friendly error messages
 */
export function processFileSystemError(
  error: unknown,
  path: string,
  operation: string,
): string {
  let errorMessage = `Unable to ${operation}: ${path}`

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
    }
  }

  return errorMessage
}
