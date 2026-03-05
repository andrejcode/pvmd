import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { validateFile } from '@/markdown/file-validation'
import { resolvePath } from './path-validation'

export interface StaticFileResult {
  data: Buffer
  contentType: string
  headers: Record<string, string>
}

/**
 * Resolves a URL-relative path to a local image file, applying layered
 * security checks:  path-traversal guard → file-stat validation (rejects
 * symlinks, directories, oversized files) → image-extension allowlist.
 *
 * SVG responses include a restrictive CSP that neutralises embedded scripts.
 */
export function resolveStaticFile(
  relativePath: string,
  baseDir: string,
): StaticFileResult {
  const ext = extname(relativePath).toLowerCase()
  const imageMimeTypes: Record<string, string> = {
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  }
  const contentType = imageMimeTypes[ext]

  if (!contentType) {
    throw new Error(`Unsupported file type: ${ext || '(none)'}`)
  }

  const filePath = resolvePath(relativePath, baseDir)
  validateFile(filePath)

  const data = readFileSync(filePath)

  const headers: Record<string, string> = {
    'content-type': contentType,
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  }

  if (ext === '.svg') {
    headers['content-security-policy'] =
      "default-src 'none'; style-src 'unsafe-inline'"
  }

  return { data, contentType, headers }
}
