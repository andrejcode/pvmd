import { config, DEFAULT_CONFIG } from '../config'
import {
  applyLocalConfig,
  fileSystem,
  findLocalConfigPath,
  loadLocalConfig,
  osPaths,
} from '../local-config'

describe('local config', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    Object.assign(config, DEFAULT_CONFIG)
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('finds the global .pvmd/config.json in the user home directory', () => {
    const originalExistsSync = fileSystem.existsSync
    const originalHomedir = osPaths.homedir
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn(
      (path) => String(path) === '/Users/tester/.pvmd/config.json',
    )

    expect(findLocalConfigPath()).toBe('/Users/tester/.pvmd/config.json')

    fileSystem.existsSync = originalExistsSync
    osPaths.homedir = originalHomedir
  })

  test('applies supported settings from local config', () => {
    const originalExistsSync = fileSystem.existsSync
    const originalReadFileSync = fileSystem.readFileSync
    const originalHomedir = osPaths.homedir
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn(
      (path) => String(path) === '/Users/tester/.pvmd/config.json',
    )
    fileSystem.readFileSync = vi.fn(() => {
      return JSON.stringify({
        port: 7777,
        skipSizeCheck: true,
        maxFileSizeMB: 5,
        watch: false,
        httpsOnly: true,
        open: true,
        browser: 'brave',
        theme: 'dark-dimmed',
      })
    })

    loadLocalConfig()

    expect(config).toMatchObject({
      port: 7777,
      skipSizeCheck: true,
      maxFileSizeMB: 5,
      watch: false,
      httpsOnly: true,
      open: true,
      browser: 'brave',
      theme: 'dark-dimmed',
    })

    fileSystem.existsSync = originalExistsSync
    fileSystem.readFileSync = originalReadFileSync
    osPaths.homedir = originalHomedir
  })

  test('warns on unsupported settings and ignores them', () => {
    applyLocalConfig({ nope: true })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: Unsupported setting "nope" in .pvmd/config.json. Supported settings: port, skipSizeCheck, maxFileSizeMB, watch, httpsOnly, open, browser, theme. Ignoring setting.',
    )
    expect(config).toMatchObject(DEFAULT_CONFIG)
  })

  test('warns on invalid boolean settings and ignores them', () => {
    applyLocalConfig({ open: 'yes' })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: Invalid setting "open" in .pvmd/config.json. Expected a boolean. Ignoring setting.',
    )
    expect(config.open).toBe(DEFAULT_CONFIG.open)
  })

  test('applies valid settings and ignores invalid ones', () => {
    applyLocalConfig({
      port: 6666,
      theme: 'dark',
      unknownConfig: 1234,
      open: true,
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: Invalid setting "port" in .pvmd/config.json. Port 6666 is blocked by browsers for security reasons. Ignoring setting.',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: Unsupported setting "unknownConfig" in .pvmd/config.json. Supported settings: port, skipSizeCheck, maxFileSizeMB, watch, httpsOnly, open, browser, theme. Ignoring setting.',
    )
    expect(config.port).toBe(DEFAULT_CONFIG.port)
    expect(config.theme).toBe('dark')
    expect(config.open).toBe(true)
  })

  test('warns and ignores invalid JSON local config files', () => {
    const originalExistsSync = fileSystem.existsSync
    const originalReadFileSync = fileSystem.readFileSync
    const originalHomedir = osPaths.homedir
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn(
      (path) => String(path) === '/Users/tester/.pvmd/config.json',
    )
    fileSystem.readFileSync = vi.fn(() => '{invalid json')

    loadLocalConfig()

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: .pvmd/config.json must be valid JSON. Ignoring local config.',
    )
    expect(config).toMatchObject(DEFAULT_CONFIG)

    fileSystem.existsSync = originalExistsSync
    fileSystem.readFileSync = originalReadFileSync
    osPaths.homedir = originalHomedir
  })
})
