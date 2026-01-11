#!/usr/bin/env node

import { run } from './app'
import { parseArguments } from './cli'

try {
  const args = process.argv.slice(2)
  const userPath = parseArguments(args)
  run(userPath)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}
