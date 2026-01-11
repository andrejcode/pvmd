import { createOptionMaps, showHelp } from './options'

export function parseArguments(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    process.exit(0)
  }

  if (args.includes('--version') || args.includes('-v')) {
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`pvmd development`)
    } else {
      console.log(`pvmd v${process.env['PVMD_VERSION']}`)
    }

    process.exit(0)
  }

  let userPath: string | null = null

  const { longToOption, shortToOption } = createOptionMaps()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg && arg.startsWith('--')) {
      const optionName = arg.slice(2)

      if (longToOption.has(optionName)) {
        const option = longToOption.get(optionName)!

        if (option.takesValue) {
          const nextArg = args[i + 1]
          option.action(nextArg)
          i++
        } else {
          option.action()
        }
      } else {
        throw new Error('Unknown option: --' + optionName)
      }
    } else if (arg && arg.startsWith('-')) {
      const optionName = arg.slice(1)

      if (shortToOption.has(optionName)) {
        const option = shortToOption.get(optionName)!

        if (option.takesValue) {
          const nextArg = args[i + 1]
          option.action(nextArg)
          i++
        } else {
          option.action()
        }
      } else {
        throw new Error('Unknown option: -' + optionName)
      }
    } else if (arg) {
      if (!userPath) {
        userPath = arg
      }
    }
  }

  if (!userPath) {
    throw new Error('Please provide a markdown file path as an argument')
  }

  return userPath
}
