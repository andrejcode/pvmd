interface Config {
  port: number
  skipSizeCheck: boolean
  maxFileSizeMB: number
  // skipConfirmation: boolean
  // watch: boolean
}

export const config: Config = {
  port: 8765,
  skipSizeCheck: false,
  maxFileSizeMB: 2,
  // skipConfirmation: false,
  // watch: true,
}
