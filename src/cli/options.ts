import {
  config,
  formatSupportedBrowsers,
  formatSupportedThemes,
  parseBrowserValue,
  parseMaxFileSizeValue,
  parsePortValue,
  parseThemeValue,
} from './config'

export interface Option {
  alias?: string
  value?: string
  takesValue?: boolean
  action: (value?: string) => void
}

export const options: Record<string, Option> = {
  port: {
    alias: 'p',
    value: '<port>',
    takesValue: true,
    action: (value?: string) => {
      config.port = parsePortValue(value)
    },
  },
  'no-size-check': {
    action: () => {
      config.skipSizeCheck = true
    },
  },
  'max-size': {
    value: '<kb>',
    takesValue: true,
    action: (value?: string) => {
      config.maxFileSize = parseMaxFileSizeValue(value)
    },
  },
  'no-watch': {
    action: () => {
      config.watch = false
    },
  },
  'https-only': {
    action: () => {
      config.httpsOnly = true
    },
  },
  open: {
    alias: 'o',
    action: () => {
      config.open = true
    },
  },
  browser: {
    alias: 'b',
    value: '<browser>',
    takesValue: true,
    action: (value?: string) => {
      config.browser = parseBrowserValue(value)
    },
  },
  theme: {
    alias: 't',
    value: '<theme>',
    takesValue: true,
    action: (value?: string) => {
      config.theme = parseThemeValue(value)
    },
  },
} as const

function formatEnabledDefault(enabled: boolean) {
  return enabled ? 'true' : 'false'
}

function getOptionDescription(key: string) {
  switch (key) {
    case 'port':
      return `Port number (default: ${config.port}; use 0 for a random available port)`
    case 'no-size-check':
      return `Skip file size validation (default: ${formatEnabledDefault(config.skipSizeCheck)})`
    case 'max-size':
      return `Maximum file size in KB (default: ${config.maxFileSize})`
    case 'no-watch':
      return `Skip file watching (default: ${formatEnabledDefault(!config.watch)})`
    case 'https-only':
      return `Only allow HTTPS URLs for images and links (default: ${formatEnabledDefault(config.httpsOnly)})`
    case 'open':
      return `Open automatically in the selected browser (default: ${formatEnabledDefault(config.open)})`
    case 'browser':
      return `Browser to open automatically (supported: ${formatSupportedBrowsers()}; default: ${config.browser})`
    case 'theme':
      return `GitHub Markdown theme to use (supported: ${formatSupportedThemes()}; default: ${config.theme})`
    default:
      return ''
  }
}

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
      description: getOptionDescription(key),
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
