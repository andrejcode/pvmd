import { lstatSync } from 'node:fs'
import { extname, normalize, resolve, sep } from 'node:path'
import { ValidationError } from './errors'

export const MD_FILE_EXTENSIONS = [
  '.md',
  '.markdown',
  '.mdown',
  '.mkdn',
  '.mkd',
  '.mdwn',
  '.mdtxt',
  '.mdtext',
]

export function validateMarkdownExtension(path: string): void {
  const extension = extname(path).toLowerCase()
  if (!MD_FILE_EXTENSIONS.includes(extension)) {
    throw new ValidationError(
      `Invalid extension for path: ${path}.\nExpected extensions: ${MD_FILE_EXTENSIONS.join(', ')}`,
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

export function resolvePath(
  userPath: string,
  baseDir: string = process.cwd(),
): string {
  const fullPath = resolve(baseDir, normalize(userPath))
  const resolvedBase = resolve(baseDir)

  if (fullPath !== resolvedBase && !fullPath.startsWith(resolvedBase + sep)) {
    throw new Error(`Path traversal are not allowed: ${fullPath}`)
  }

  return fullPath
}
