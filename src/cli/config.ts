export const SUPPORTED_BROWSERS = [
  'default',
  'chrome',
  'firefox',
  'edge',
  'brave',
] as const

export type BrowserOption = (typeof SUPPORTED_BROWSERS)[number]

export const SUPPORTED_THEMES = [
  'default',
  'light',
  'dark',
  'dark-dimmed',
  'dark-high-contrast',
  'dark-colorblind',
  'light-colorblind',
] as const

export type ThemeOption = (typeof SUPPORTED_THEMES)[number]

export const LOCAL_CONFIG_DIRECTORY_NAME = '.pvmd'
export const LOCAL_CONFIG_BASENAME = 'config.json'
export const LOCAL_CONFIG_RELATIVE_PATH = `${LOCAL_CONFIG_DIRECTORY_NAME}/${LOCAL_CONFIG_BASENAME}`

export interface Config {
  port: number
  skipSizeCheck: boolean
  maxFileSize: number
  watch: boolean
  httpsOnly: boolean
  open: boolean
  browser: BrowserOption
  theme: ThemeOption
}

export const DEFAULT_CONFIG: Config = {
  port: 8765,
  skipSizeCheck: false,
  maxFileSize: 512,
  watch: true,
  httpsOnly: false,
  open: false,
  browser: 'default',
  theme: 'default',
}

export const config: Config = {
  ...DEFAULT_CONFIG,
}

// Browsers intentionally refuse to navigate to certain ports to prevent
// cross-protocol attacks against well-known services.
const BROWSER_UNSAFE_PORTS = new Set<number>([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 77, 79, 87,
  95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139,
  143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540,
  548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049,
  3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080,
])

export function formatSupportedBrowsers() {
  return SUPPORTED_BROWSERS.join(', ')
}

export function formatSupportedThemes() {
  return SUPPORTED_THEMES.join(', ')
}

export function parsePortValue(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    throw new Error('Port option requires a value.')
  }

  const parsed = Number(value)
  if (isNaN(parsed)) {
    throw new Error('Port must be a number.')
  }

  if (!Number.isInteger(parsed)) {
    throw new Error('Port must be an integer.')
  }

  if (parsed < 0 || parsed > 65535) {
    throw new Error('Port must be between 0 and 65535.')
  }

  if (parsed !== 0 && BROWSER_UNSAFE_PORTS.has(parsed)) {
    throw new Error(
      `Port ${parsed} is blocked by browsers for security reasons.`,
    )
  }

  return parsed
}

export function parseMaxFileSizeValue(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    throw new Error('Max size option requires a value.')
  }

  const parsed = Number(value)
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error('Max size must be a positive number.')
  }

  return parsed
}

export function parseBrowserValue(value: unknown): BrowserOption {
  if (typeof value !== 'string' || value.trim() === '') {
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

export function parseThemeValue(value: unknown): ThemeOption {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Theme option requires a value. Supported themes: ${formatSupportedThemes()}.`,
    )
  }

  const normalized = value.trim().toLowerCase()

  if (!SUPPORTED_THEMES.includes(normalized as ThemeOption)) {
    throw new Error(
      `Unsupported theme "${value}". Supported themes: ${formatSupportedThemes()}.`,
    )
  }

  return normalized as ThemeOption
}
