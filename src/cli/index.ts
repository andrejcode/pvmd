import { loadLocalConfig } from './local-config'
import { resolveOption, showHelp } from './options'

function handleHelp(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    loadLocalConfig()
    showHelp()
    process.exit(0)
  }
}

function handleVersion(args: string[]) {
  if (args.includes('--version') || args.includes('-v')) {
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`pvmd development`)
    } else {
      console.log(`pvmd v${process.env['PVMD_VERSION']}`)
    }

    process.exit(0)
  }
}

export function parseArguments(args: string[]) {
  handleHelp(args)
  handleVersion(args)
  loadLocalConfig()

  let userPath: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue

    const option = resolveOption(arg)

    if (option) {
      if (option.takesValue) {
        option.action(args[i + 1])
        i++
      } else {
        option.action()
      }
    } else if (!userPath) {
      userPath = arg
    }
  }

  if (!userPath) {
    throw new Error('Please provide a markdown file path as an argument')
  }

  return userPath
}
