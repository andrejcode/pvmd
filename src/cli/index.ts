import { printHelp, printVersion } from './print'

export interface CliOptions {
  userPath: string
}
export function parseArguments(args: string[]): CliOptions {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  if (args.includes('--version') || args.includes('-v')) {
    printVersion()
    process.exit(0)
  }

  // TODO: Check other options and handle them properly
  if (args.length === 0 || !args[0]) {
    throw new Error(
      'Please provide a markdown file path as argument.\nUsage: pvmd <file.md>',
    )
  }

  return {
    userPath: args[0],
  }
}
