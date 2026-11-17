#!/usr/bin/env node

import { run } from './app'
import { parseArguments } from './cli'
import { runNeovim } from './nvim'
import { exitWithError } from './utils/fatal-error'

try {
  const args = process.argv.slice(2)
  const nvim = process.env['PVMD_NVIM'] === '1'
  const userPath = parseArguments(args, nvim)
  if (nvim) {
    runNeovim()
  } else {
    run(userPath)
  }
} catch (error) {
  exitWithError(error)
}
