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
      if (isNaN(parsed) || parsed < 0) {
        throw new Error('Max size must be a positive number')
      }

      config.maxFileSizeMB = parsed
    },
  },
} as const

export function createOptionMaps() {
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

export function showHelp() {
  // TODO: Add options
  // -y, --yes               Skip confirmation prompt
  // --no-watch              Skip file watching

  const flagsToShow: Record<
    string,
    { flagString: string; description: string }
  > = {}

  for (const [key, value] of Object.entries(options)) {
    const flagString = `-${value.alias}, --${key}${value.value ? ` ${value.value}` : ''}`
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
