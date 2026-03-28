export function exitWithError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)

  console.error(message)
  process.exit(1)
}
