export const SUPPORTED_BROWSERS = [
  'default',
  'chrome',
  'firefox',
  'edge',
  'brave',
] as const

export type BrowserOption = (typeof SUPPORTED_BROWSERS)[number]

interface Config {
  port: number
  skipSizeCheck: boolean
  maxFileSizeMB: number
  watch: boolean
  httpsOnly: boolean
  open: boolean
  browser: BrowserOption
}

export const DEFAULT_CONFIG: Config = {
  port: 8765,
  skipSizeCheck: false,
  maxFileSizeMB: 2,
  watch: true,
  httpsOnly: false,
  open: false,
  browser: 'default',
}

export const config: Config = {
  ...DEFAULT_CONFIG,
}
