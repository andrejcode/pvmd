#!/usr/bin/env node

import { run } from './app'
import { parseArguments } from './cli'
import { exitWithError } from './utils/fatal-error'

try {
  const args = process.argv.slice(2)
  const userPath = parseArguments(args)
  run(userPath)
} catch (error) {
  exitWithError(error)
}
