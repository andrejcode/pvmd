import { normalize, resolve, sep } from 'node:path'

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
