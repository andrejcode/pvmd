interface Config {
  port: number
  skipSizeCheck: boolean
  maxFileSizeMB: number
  watch: boolean
  httpsOnly: boolean
}

export const config: Config = {
  port: 8765,
  skipSizeCheck: false,
  maxFileSizeMB: 2,
  watch: true,
  httpsOnly: false,
}
