import {
  config,
  DEFAULT_CONFIG,
  SUPPORTED_BROWSERS,
  type BrowserOption,
} from './config'

// Browsers intentionally refuse to navigate to certain ports to prevent
// cross-protocol attacks against well-known services.
const BROWSER_UNSAFE_PORTS = new Set<number>([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 77, 79, 87,
  95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139,
  143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540,
  548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049,
  3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080,
])

interface Option {
  alias?: string
  description: string
  value?: string
  takesValue?: boolean
  action: (value?: string) => void
}

function formatSupportedBrowsers() {
  return SUPPORTED_BROWSERS.join(', ')
}

function parseBrowserOption(value: string | undefined): BrowserOption {
  if (!value) {
    throw new Error(
      `Browser option requires a value. Supported browsers: ${formatSupportedBrowsers()}.`,
    )
  }

  const normalized = value.trim().toLowerCase()

  if (!SUPPORTED_BROWSERS.includes(normalized as BrowserOption)) {
    throw new Error(
      `Unsupported browser "${value}". Supported browsers: ${formatSupportedBrowsers()}.`,
    )
  }

  return normalized as BrowserOption
}

const options: Record<string, Option> = {
  port: {
    alias: 'p',
    description: `Port number (default: ${DEFAULT_CONFIG.port}; use 0 for a random available port)`,
    value: '<port>',
    takesValue: true,
    action: (value?: string) => {
      if (!value) {
        throw new Error('Port option requires a value')
      }

      const parsed = Number(value)
      if (isNaN(parsed)) {
        throw new Error('Port must be a number')
      }

      if (!Number.isInteger(parsed)) {
        throw new Error('Port must be an integer')
      }

      if (parsed < 0 || parsed > 65535) {
        throw new Error('Port must be between 0 and 65535')
      }

      if (parsed !== 0 && BROWSER_UNSAFE_PORTS.has(parsed)) {
        throw new Error(
          `Port ${parsed} is blocked by browsers for security reasons. Please choose a different port.`,
        )
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
    description: `Maximum file size in MB (default: ${DEFAULT_CONFIG.maxFileSizeMB})`,
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
      config.browser = parseBrowserOption(value)
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
