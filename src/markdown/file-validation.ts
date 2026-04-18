import { lstatSync, type Stats } from 'node:fs'
import { extname } from 'node:path'
import { config } from '@/cli/config'
import { processFileSystemError } from '@/utils/file-error'

const VALID_MARKDOWN_EXTENSIONS: readonly string[] = [
  '.md',
  '.markdown',
  '.mdown',
  '.mkdn',
  '.mkd',
  '.mdwn',
  '.mdtxt',
  '.mdtext',
] as const

const FILE_SIZE_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 20,
  useGrouping: false,
})

function formatMaxFileSize(sizeInKB: number): string {
  return FILE_SIZE_FORMATTER.format(sizeInKB)
}

export function validateMarkdownExtension(path: string): void {
  const extension = extname(path).toLowerCase()

  if (!VALID_MARKDOWN_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Invalid extension for path: ${path}.\nExpected extensions: ${VALID_MARKDOWN_EXTENSIONS.join(', ')}`,
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
    const maxFileSizeBytes = config.maxFileSize * 1024
    const maxFileSizeLabel = formatMaxFileSize(config.maxFileSize)

    if (stats.size > maxFileSizeBytes) {
      throw new Error(
        `File is too large: ${path}. Maximum size is ${maxFileSizeLabel} KB.\nUse --no-size-check to disable file size validation or --max-size <kb> to raise the limit.`,
      )
    }
  }
}
