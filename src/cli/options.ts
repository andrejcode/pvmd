import {
  config,
  formatSupportedBrowsers,
  formatSupportedThemes,
  parseBrowserValue,
  parseMaxFileSizeValue,
  parsePortValue,
  parseThemeValue,
  type Config,
} from './config'

export type TerminalAction = 'help' | 'version'

export interface Option {
  alias?: string
  value?: string
  takesValue?: boolean
  // Config options can update runtime config, while terminal options exit after printing help/version
  kind: 'config' | 'terminal'
  configKey?: keyof Config
  terminalAction?: TerminalAction
  // Help text is computed at render time so defaults reflect config loaded for this run
  description: () => string
  action?: (value?: string) => void
}

export interface ResolvedOption {
  name: string
  option: Option
}

function formatEnabledDefault(enabled: boolean) {
  return enabled ? 'true' : 'false'
}

export const options: Record<string, Option> = {
  port: {
    kind: 'config',
    alias: 'p',
    value: '<port>',
    takesValue: true,
    configKey: 'port',
    description: () => {
      return `Port number (default: ${config.port}; use 0 for a random available port)`
    },
    action: (value?: string) => {
      config.port = parsePortValue(value)
    },
  },
  'no-size-check': {
    kind: 'config',
    configKey: 'skipSizeCheck',
    description: () => {
      return `Skip file size validation (default: ${formatEnabledDefault(config.skipSizeCheck)})`
    },
    action: () => {
      config.skipSizeCheck = true
    },
  },
  'no-local-config': {
    kind: 'config',
    description: () => {
      return 'Ignore ~/.pvmd/config.json and use built-in defaults as the baseline'
    },
  },
  'max-size': {
    kind: 'config',
    value: '<kb>',
    takesValue: true,
    configKey: 'maxFileSize',
    description: () => {
      return `Maximum file size in KB (default: ${config.maxFileSize})`
    },
    action: (value?: string) => {
      config.maxFileSize = parseMaxFileSizeValue(value)
    },
  },
  'no-watch': {
    kind: 'config',
    configKey: 'watch',
    description: () => {
      return `Skip file watching (default: ${formatEnabledDefault(!config.watch)})`
    },
    action: () => {
      config.watch = false
    },
  },
  'https-only': {
    kind: 'config',
    configKey: 'httpsOnly',
    description: () => {
      return `Only allow HTTPS URLs for images and links (default: ${formatEnabledDefault(config.httpsOnly)})`
    },
    action: () => {
      config.httpsOnly = true
    },
  },
  open: {
    kind: 'config',
    alias: 'o',
    configKey: 'open',
    description: () => {
      return `Open automatically in the selected browser (default: ${formatEnabledDefault(config.open)})`
    },
    action: () => {
      config.open = true
    },
  },
  browser: {
    kind: 'config',
    alias: 'b',
    value: '<browser>',
    takesValue: true,
    configKey: 'browser',
    description: () => {
      return `Browser to open automatically (supported: ${formatSupportedBrowsers()}; default: ${config.browser})`
    },
    action: (value?: string) => {
      config.browser = parseBrowserValue(value)
    },
  },
  theme: {
    kind: 'config',
    alias: 't',
    value: '<theme>',
    takesValue: true,
    configKey: 'theme',
    description: () => {
      return `GitHub Markdown theme to use (supported: ${formatSupportedThemes()}; default: ${config.theme})`
    },
    action: (value?: string) => {
      config.theme = parseThemeValue(value)
    },
  },
  help: {
    kind: 'terminal',
    alias: 'h',
    terminalAction: 'help',
    description: () => {
      return 'Show help'
    },
  },
  version: {
    kind: 'terminal',
    alias: 'v',
    terminalAction: 'version',
    description: () => {
      return 'Show version'
    },
  },
} as const

const longToOption = new Map<string, Option>()
const shortToOption = new Map<string, ResolvedOption>()

for (const [key, value] of Object.entries(options)) {
  longToOption.set(key, value)

  if (value.alias) {
    shortToOption.set(value.alias, { name: key, option: value })
  }
}

export function resolveOption(arg: string): ResolvedOption | null {
  if (arg.startsWith('--')) {
    const name = arg.slice(2)
    const option = longToOption.get(name)
    if (!option) throw new Error('Unknown option: --' + name)
    return { name, option }
  }

  if (arg.startsWith('-')) {
    const name = arg.slice(1)
    const resolved = shortToOption.get(name)
    if (!resolved) throw new Error('Unknown option: -' + name)
    return resolved
  }

  return null
}

export function formatOptionName(name: string) {
  return `--${name}`
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
      description: value.description(),
    }
  }

  console.log('Usage: pvmd [options] <file>')
  console.log('\nOptions:')

  const maxLength = Math.max(
    ...Object.values(flagsToShow).map((flag) => flag.flagString.length),
  )

  for (const flag of Object.values(flagsToShow)) {
    const padding = ' '.repeat(maxLength - flag.flagString.length + 3)
    console.log(`${flag.flagString}${padding}${flag.description}`)
  }
}
