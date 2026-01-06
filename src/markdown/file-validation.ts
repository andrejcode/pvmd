import { lstatSync } from 'node:fs'
import { extname } from 'node:path'

export class ValidationError extends Error {}

export function validateMarkdownExtension(path: string): void {
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
  const extension = extname(path).toLowerCase()

  if (!validExtensions.includes(extension)) {
    throw new ValidationError(
      `Invalid extension for path: ${path}.\nExpected extensions: ${validExtensions.join(', ')}`,
    )
  }
}

export function validateFile(path: string): void {
  const stats = lstatSync(path)

  if (stats.isDirectory()) {
    throw new ValidationError(`Path is a directory: ${path}`)
  }

  if (stats.isSymbolicLink()) {
    throw new ValidationError(`Path is a symbolic link: ${path}`)
  }

  if (!stats.isFile()) {
    throw new ValidationError(`Path is not a file: ${path}`)
  }
}
