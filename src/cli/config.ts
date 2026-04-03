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

interface Config {
  port: number
  skipSizeCheck: boolean
  maxFileSizeMB: number
  watch: boolean
  httpsOnly: boolean
  open: boolean
  browser: BrowserOption
  theme: ThemeOption
}

export const DEFAULT_CONFIG: Config = {
  port: 8765,
  skipSizeCheck: false,
  maxFileSizeMB: 2,
  watch: true,
  httpsOnly: false,
  open: false,
  browser: 'default',
  theme: 'default',
}

export const config: Config = {
  ...DEFAULT_CONFIG,
}
