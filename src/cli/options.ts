import {
  config,
  DEFAULT_CONFIG,
  formatSupportedBrowsers,
  formatSupportedThemes,
  parseBrowserValue,
  parseMaxFileSizeValue,
  parsePortValue,
  parseThemeValue,
} from './config'

export interface Option {
  alias?: string
  description: string
  value?: string
  takesValue?: boolean
  action: (value?: string) => void
}

export const options: Record<string, Option> = {
  port: {
    alias: 'p',
    description: `Port number (default: ${DEFAULT_CONFIG.port}; use 0 for a random available port)`,
    value: '<port>',
    takesValue: true,
    action: (value?: string) => {
      config.port = parsePortValue(value)
    },
  },
  'no-size-check': {
    description: 'Skip file size validation',
    action: () => {
      config.skipSizeCheck = true
    },
  },
  'max-size': {
    description: `Maximum file size in MB (default: ${DEFAULT_CONFIG.maxFileSizeMB})`,
    value: '<mb>',
    takesValue: true,
    action: (value?: string) => {
      config.maxFileSizeMB = parseMaxFileSizeValue(value)
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
    description: 'Open automatically in the selected browser',
    action: () => {
      config.open = true
    },
  },
  browser: {
    alias: 'b',
    description: `Browser to open automatically (supported: ${formatSupportedBrowsers()}; default: ${DEFAULT_CONFIG.browser})`,
    value: '<browser>',
    takesValue: true,
    action: (value?: string) => {
      config.browser = parseBrowserValue(value)
    },
  },
  theme: {
    alias: 't',
    description: `GitHub Markdown theme to use (supported: ${formatSupportedThemes()}; default: ${DEFAULT_CONFIG.theme})`,
    value: '<theme>',
    takesValue: true,
    action: (value?: string) => {
      config.theme = parseThemeValue(value)
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
