import { join } from 'node:path'

export interface CliOptions {
  filePath: string
}

export function parseArguments(args: string[]): CliOptions {
  if (args.length === 0 || !args[0]) {
    throw new Error(
      'Please provide a markdown file path as argument.\nUsage: pvmd <file.md>',
    )
  }

  return {
    filePath: join(process.cwd(), args[0]),
  }
}
