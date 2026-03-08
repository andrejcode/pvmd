import { config } from './config'

interface Option {
  alias?: string
  description: string
  value?: string
  takesValue?: boolean
  action: (value?: string) => void
}

const options: Record<string, Option> = {
  port: {
    alias: 'p',
    description: `Port number (default: ${config.port})`,
    value: '<port>',
    takesValue: true,
    action: (value?: string) => {
      if (!value) {
        throw new Error('Port option requires a value')
      }

      const parsed = Number(value)
      if (isNaN(parsed) || parsed < 1024 || parsed > 49151) {
        throw new Error('Port must be between 1024 and 49151')
      }

      config.port = parsed
    },
  },
  'no-size-check': {
    description: 'Skip file size validation',
    action: () => {
      config.skipSizeCheck = true
    },
  },
  'max-size': {
    description: `Maximum file size in MB (default: ${config.maxFileSizeMB})`,
    value: '<mb>',
    takesValue: true,
    action: (value?: string) => {
      if (!value) {
        throw new Error('Max size option requires a value')
      }

      const parsed = Number(value)
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('Max size must be a positive number')
      }

      config.maxFileSizeMB = parsed
    },
  },
  'no-watch': {
    description: 'Skip file watching',
    action: () => {
      config.watch = false
    },
  },
  'https-only': {
    description: 'Only allow HTTPS URLs for images and links',
    action: () => {
      config.httpsOnly = true
    },
  },
  open: {
    alias: 'o',
    description: 'Open in default browser automatically',
    action: () => {
      config.open = true
    },
  },
} as const

function createOptionMaps() {
  const longToOption = new Map<string, Option>()
  const shortToOption = new Map<string, Option>()

  for (const [key, value] of Object.entries(options)) {
    longToOption.set(key, value)

    if (value.alias) {
      shortToOption.set(value.alias, value)
    }
  }

  return { longToOption, shortToOption }
}

export function resolveOption(arg: string) {
  const { longToOption, shortToOption } = createOptionMaps()

  if (arg.startsWith('--')) {
    const name = arg.slice(2)
    const option = longToOption.get(name)
    if (!option) throw new Error('Unknown option: --' + name)
    return option
  }

  if (arg.startsWith('-')) {
    const name = arg.slice(1)
    const option = shortToOption.get(name)
    if (!option) throw new Error('Unknown option: -' + name)
    return option
  }

  return null
}

export function showHelp() {
  const flagsToShow: Record<
    string,
    { flagString: string; description: string }
  > = {}

  for (const [key, value] of Object.entries(options)) {
    const longFlag = `--${key}${value.value ? ` ${value.value}` : ''}`
    const flagString = value.alias ? `-${value.alias}, ${longFlag}` : longFlag
    flagsToShow[key] = {
      flagString,
      description: value.description,
    }
  }

  flagsToShow['help'] = {
    flagString: '-h, --help',
    description: 'Show help',
  }
  flagsToShow['version'] = {
    flagString: '-v, --version',
    description: 'Show version',
  }

  const maxLength = Math.max(
    ...Object.values(flagsToShow).map((flag) => flag.flagString.length),
  )

  console.log('Usage: pvmd [options] <file>')
  console.log('\nOptions:')

  for (const flag of Object.values(flagsToShow)) {
    const padding = ' '.repeat(maxLength - flag.flagString.length + 3)
    console.log(`${flag.flagString}${padding}${flag.description}`)
  }
}
