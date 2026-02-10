import { lstatSync, type Stats } from 'node:fs'
import { extname } from 'node:path'
import { config } from '../cli/config'
import { processFileSystemError } from '../utils/file-error'

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
    throw new Error(
      `Invalid extension for path: ${path}.\nExpected extensions: ${validExtensions.join(', ')}`,
    )
  }
}

export function validateFile(path: string): void {
  let stats: Stats
  try {
    stats = lstatSync(path)
  } catch (error) {
    throw new Error(processFileSystemError(error, path))
  }

  if (stats.isDirectory()) {
    throw new Error(`Path is a directory: ${path}`)
  }

  if (stats.isSymbolicLink()) {
    throw new Error(`Path is a symbolic link: ${path}`)
  }

  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${path}`)
  }

  if (!config.skipSizeCheck) {
    const maxFileSizeBytes = config.maxFileSizeMB * 1024 * 1024

    if (stats.size > maxFileSizeBytes) {
      throw new Error(
        `File is too large: ${path}. Maximum size is ${config.maxFileSizeMB} MB`,
      )
    }
  }
}
