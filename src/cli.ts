export interface CliOptions {
  userPath: string
}

export function parseArguments(args: string[]): CliOptions {
  if (args.length === 0 || !args[0]) {
    throw new Error(
      'Please provide a markdown file path as argument.\nUsage: pvmd <file.md>',
    )
  }

  return {
    userPath: args[0],
  }
}
