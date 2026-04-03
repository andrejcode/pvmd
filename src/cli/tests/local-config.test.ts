import { config, DEFAULT_CONFIG } from '../config'
import {
  applyLocalConfig,
  fileSystem,
  findLocalConfigPath,
  loadLocalConfig,
  osPaths,
} from '../local-config'

describe('local config', () => {
  beforeEach(() => {
    Object.assign(config, DEFAULT_CONFIG)
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

  test('throws on unsupported settings', () => {
    expect(() => applyLocalConfig({ nope: true })).toThrow(
      'Unsupported setting "nope" in .pvmd/config.json. Supported settings: port, skipSizeCheck, maxFileSizeMB, watch, httpsOnly, open, browser, theme.',
    )
  })

  test('throws on invalid boolean settings', () => {
    expect(() => applyLocalConfig({ open: 'yes' })).toThrow(
      'Invalid setting "open" in .pvmd/config.json. Expected a boolean.',
    )
  })
})
