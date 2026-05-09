import { config, DEFAULT_CONFIG } from '../config'
import {
  applyLocalConfig,
  fileSystem,
  findLocalConfigPath,
  loadLocalConfig,
  loadLocalConfigWithBlockedKeys,
  osPaths,
} from '../local-config'

describe('local config', () => {
  const originalExistsSync = fileSystem.existsSync
  const originalReadFileSync = fileSystem.readFileSync
  const originalHomedir = osPaths.homedir
  const testConfigPath = '/Users/tester/.pvmd/config.json'

  function mockLocalConfigFile(value: Record<string, unknown> | string = {}) {
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn((path) => String(path) === testConfigPath)
    fileSystem.readFileSync = vi.fn(() => {
      return typeof value === 'string' ? value : JSON.stringify(value)
    })
  }

  beforeEach(() => {
    Object.assign(config, DEFAULT_CONFIG)
  })

  afterEach(() => {
    fileSystem.existsSync = originalExistsSync
    fileSystem.readFileSync = originalReadFileSync
    osPaths.homedir = originalHomedir
    vi.restoreAllMocks()
  })

  test('finds the global .pvmd/config.json in the user home directory', () => {
    mockLocalConfigFile()

    expect(findLocalConfigPath()).toBe(testConfigPath)
  })

  describe('loading config files', () => {
    test('applies supported settings from local config', () => {
      mockLocalConfigFile({
        port: 7777,
        skipSizeCheck: true,
        maxFileSize: 640,
        watch: false,
        httpsOnly: true,
        open: true,
        browser: 'brave',
        theme: 'dark-dimmed',
      })

      loadLocalConfig()

      expect(config).toMatchObject({
        port: 7777,
        skipSizeCheck: true,
        maxFileSize: 640,
        watch: false,
        httpsOnly: true,
        open: true,
        browser: 'brave',
      })
      expect(config.theme).toBe('dark-dimmed')
    })

    test('skips blocked keys while applying remaining local config settings', () => {
      mockLocalConfigFile({
        port: 7777,
        open: true,
        browser: 'brave',
      })

      loadLocalConfigWithBlockedKeys(new Set(['port']))

      expect(config.port).toBe(DEFAULT_CONFIG.port)
      expect(config.open).toBe(true)
      expect(config.browser).toBe('brave')
    })

    test('warns and ignores invalid JSON local config files', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      mockLocalConfigFile('{invalid json')

      loadLocalConfig()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '.pvmd/config.json must be valid JSON. Ignoring local config.',
      )
      expect(config).toMatchObject(DEFAULT_CONFIG)
    })
  })

  describe('applying parsed config', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    test('warns on unsupported settings and ignores them', () => {
      applyLocalConfig({ nope: true })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Unsupported setting "nope" in .pvmd/config.json. Supported settings: port, skipSizeCheck, maxFileSize, watch, httpsOnly, open, browser, theme. Ignoring setting.',
      )
      expect(config).toMatchObject(DEFAULT_CONFIG)
    })

    test('warns on invalid boolean settings and ignores them', () => {
      applyLocalConfig({ open: 'yes' })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid setting "open" in .pvmd/config.json. Expected a boolean. Ignoring setting.',
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
        'Invalid setting "port" in .pvmd/config.json. Port 6666 is blocked by browsers for security reasons. Ignoring setting.',
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Unsupported setting "unknownConfig" in .pvmd/config.json. Supported settings: port, skipSizeCheck, maxFileSize, watch, httpsOnly, open, browser, theme. Ignoring setting.',
      )
      expect(config.port).toBe(DEFAULT_CONFIG.port)
      expect(config.theme).toBe('dark')
      expect(config.open).toBe(true)
    })
  })
})
