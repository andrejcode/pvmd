import { type MockInstance } from 'vitest'
import { config, DEFAULT_CONFIG } from '../config'
import { parseArguments } from '../index'
import { fileSystem, osPaths } from '../local-config'

describe('parseArguments', () => {
  let consoleLogSpy: MockInstance
  let consoleWarnSpy: MockInstance
  let processExitSpy: MockInstance
  const originalExistsSync = fileSystem.existsSync
  const originalReadFileSync = fileSystem.readFileSync
  const originalHomedir = osPaths.homedir

  function mockLocalConfig(value: Record<string, unknown> | string) {
    fileSystem.existsSync = vi.fn(
      (path) => String(path) === '/Users/tester/.pvmd/config.json',
    )
    fileSystem.readFileSync = vi.fn(() => {
      return typeof value === 'string' ? value : JSON.stringify(value)
    })
  }

  beforeEach(() => {
    Object.assign(config, DEFAULT_CONFIG)
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn(() => false)
    fileSystem.readFileSync = originalReadFileSync
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`)
    })
  })

  afterEach(() => {
    fileSystem.existsSync = originalExistsSync
    fileSystem.readFileSync = originalReadFileSync
    osPaths.homedir = originalHomedir
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    processExitSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  test('prints help for --help and -h', () => {
    expect(() => parseArguments(['--help'])).toThrow(
      'Process exited with code 0',
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pvmd [options] <file>'),
    )

    consoleLogSpy.mockClear()

    expect(() => parseArguments(['-h'])).toThrow('Process exited with code 0')
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pvmd [options] <file>'),
    )
  })

  test('prints help with effective defaults from local config', () => {
    mockLocalConfig({
      port: 8123,
      skipSizeCheck: true,
      maxFileSize: 640,
      watch: false,
      httpsOnly: true,
      open: true,
      browser: 'firefox',
      theme: 'dark',
    })

    expect(() => parseArguments(['--help'])).toThrow(
      'Process exited with code 0',
    )

    const output = consoleLogSpy.mock.calls.flat().join('\n')

    expect(output).toContain(
      'Port number (default: 8123; use 0 for a random available port)',
    )
    expect(output).toContain('Skip file size validation (default: true)')
    expect(output).toContain('Maximum file size in KB (default: 640)')
    expect(output).toContain('Skip file watching (default: true)')
    expect(output).toContain(
      'Only allow HTTPS URLs for images and links (default: true)',
    )
    expect(output).toContain(
      'Open automatically in the selected browser (default: true)',
    )
    expect(output).toContain(
      'Browser to open automatically (supported: default, chrome, firefox, edge, brave; default: firefox)',
    )
    expect(output).toContain(
      'GitHub Markdown theme to use (supported: default, light, dark, dark-dimmed, dark-high-contrast, dark-colorblind, light-colorblind; default: dark)',
    )
  })

  test('applies valid scheduled CLI assignments before rendering help', () => {
    expect(() => parseArguments(['--port', '9000', '--help'])).toThrow(
      'Process exited with code 0',
    )

    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain(
      'Port number (default: 9000; use 0 for a random available port)',
    )
  })

  test.each([
    ['-h', '--no-local-config'],
    ['--help', '--no-local-config'],
    ['--no-local-config', '-h'],
    ['--no-local-config', '--help'],
  ])(
    'shows built-in help defaults when local config is skipped: %s %s',
    (...args) => {
      mockLocalConfig({
        port: 8123,
        skipSizeCheck: true,
        maxFileSize: 640,
        watch: false,
        httpsOnly: true,
        open: true,
        browser: 'firefox',
        theme: 'dark',
      })

      expect(() => parseArguments(args)).toThrow('Process exited with code 0')

      const output = consoleLogSpy.mock.calls.flat().join('\n')

      expect(output).toContain(
        'Port number (default: 8765; use 0 for a random available port)',
      )
      expect(output).toContain('Skip file size validation (default: false)')
      expect(output).toContain('Maximum file size in KB (default: 512)')
      expect(output).toContain('Skip file watching (default: false)')
      expect(output).toContain(
        'Only allow HTTPS URLs for images and links (default: false)',
      )
      expect(output).toContain(
        'Open automatically in the selected browser (default: false)',
      )
      expect(output).toContain(
        'Browser to open automatically (supported: default, chrome, firefox, edge, brave; default: default)',
      )
      expect(output).toContain(
        'GitHub Markdown theme to use (supported: default, light, dark, dark-dimmed, dark-high-contrast, dark-colorblind, light-colorblind; default: default)',
      )
      expect(fileSystem.readFileSync).not.toHaveBeenCalled()

      consoleLogSpy.mockClear()
    },
  )

  test('shows help instead of duplicate-option errors when help appears later', () => {
    expect(() => parseArguments(['--open', '--open', '--help'])).toThrow(
      'Process exited with code 0',
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pvmd [options] <file>'),
    )
  })

  test('shows help even when deferred validation would fail', () => {
    expect(() => parseArguments(['--port', '-1', '--help'])).toThrow(
      'Process exited with code 0',
    )

    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain(
      'Port number (default: 8765; use 0 for a random available port)',
    )
  })

  test('prints help even when local config is invalid', () => {
    mockLocalConfig({ port: 6666 })

    expect(() => parseArguments(['--help'])).toThrow(
      'Process exited with code 0',
    )

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Invalid setting "port" in .pvmd/config.json. Port 6666 is blocked by browsers for security reasons. Ignoring setting.',
    )
  })

  test('prints version for --version and -v', () => {
    vi.stubEnv('PVMD_VERSION', '0.0.0')

    expect(() => parseArguments(['--version'])).toThrow(
      'Process exited with code 0',
    )
    expect(consoleLogSpy).toHaveBeenCalledWith('pvmd v0.0.0')

    consoleLogSpy.mockClear()

    expect(() => parseArguments(['-v'])).toThrow('Process exited with code 0')
    expect(consoleLogSpy).toHaveBeenCalledWith('pvmd v0.0.0')
  })

  test('prints version instead of duplicate-option errors', () => {
    vi.stubEnv('PVMD_VERSION', '0.0.0')

    expect(() => parseArguments(['--version', '--open', '--open'])).toThrow(
      'Process exited with code 0',
    )
    expect(consoleLogSpy).toHaveBeenCalledWith('pvmd v0.0.0')
  })

  test('returns the first markdown path when parsing succeeds', () => {
    expect(parseArguments(['test.md'])).toBe('test.md')
  })

  test('requires a markdown path when no terminal action is requested', () => {
    expect(() => parseArguments([])).toThrow(
      'Please provide a markdown file path as an argument',
    )
    expect(() => parseArguments([''])).toThrow(
      'Please provide a markdown file path as an argument',
    )
  })

  test('treats multiple markdown paths as an error', () => {
    expect(() => parseArguments(['first.md', 'second.md'])).toThrow(
      'Only one markdown file path may be provided.',
    )
  })

  test('shows help instead of multiple markdown path errors', () => {
    expect(() => parseArguments(['first.md', 'second.md', '--help'])).toThrow(
      'Process exited with code 0',
    )
  })

  test('loads local config only for keys not specified on the CLI', () => {
    mockLocalConfig({
      port: 8123,
      open: true,
      browser: 'firefox',
      theme: 'dark',
    })

    const userPath = parseArguments([
      'test.md',
      '--port',
      '9000',
      '--theme',
      'light',
    ])

    expect(userPath).toBe('test.md')
    expect(config.port).toBe(9000)
    expect(config.open).toBe(true)
    expect(config.browser).toBe('firefox')
    expect(config.theme).toBe('light')
  })

  test('skips local config entirely when --no-local-config is provided', () => {
    mockLocalConfig({
      port: 8123,
      open: true,
      browser: 'firefox',
      theme: 'dark',
    })

    const userPath = parseArguments([
      '--no-local-config',
      'test.md',
      '--port',
      '9000',
      '--theme',
      'light',
    ])

    expect(userPath).toBe('test.md')
    expect(config.port).toBe(9000)
    expect(config.open).toBe(false)
    expect(config.browser).toBe('default')
    expect(config.theme).toBe('light')
  })

  test('warns and ignores invalid local config JSON', () => {
    mockLocalConfig('{invalid json')

    expect(parseArguments(['test.md'])).toBe('test.md')
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '.pvmd/config.json must be valid JSON. Ignoring local config.',
    )
  })

  test('accepts port 0 as a deferred valid port value', () => {
    parseArguments(['test.md', '--port', '0'])
    expect(config.port).toBe(0)
  })

  test('validates port values during finalization', () => {
    expect(() => parseArguments(['test.md', '--port', '-1'])).toThrow(
      'Port must be between 0 and 65535.',
    )
    expect(() => parseArguments(['test.md', '--port', '70000'])).toThrow(
      'Port must be between 0 and 65535.',
    )
    expect(() => parseArguments(['test.md', '--port', 'abc'])).toThrow(
      'Port must be a number.',
    )
    expect(() => parseArguments(['test.md', '--port', '1234.5'])).toThrow(
      'Port must be an integer.',
    )
    expect(() => parseArguments(['test.md', '--port', '6000'])).toThrow(
      'Port 6000 is blocked by browsers for security reasons.',
    )
  })

  test('treats a missing port value as a scan-time error', () => {
    expect(() => parseArguments(['test.md', '--port'])).toThrow(
      'Port option requires a value.',
    )
  })

  test('reports duplicate port options before deferred validation errors', () => {
    expect(() =>
      parseArguments(['test.md', '--port', '-1', '-p', '1234']),
    ).toThrow('Option "--port" was provided multiple times.')
  })

  test('reports duplicate boolean options as an error', () => {
    expect(() => parseArguments(['test.md', '--open', '--open'])).toThrow(
      'Option "--open" was provided multiple times.',
    )
  })

  test('treats duplicate no-local-config as an error', () => {
    expect(() =>
      parseArguments(['test.md', '--no-local-config', '--no-local-config']),
    ).toThrow('Option "--no-local-config" was provided multiple times.')
  })

  test('treats unknown options as an error when no terminal action is present', () => {
    expect(() => parseArguments(['test.md', '--wat'])).toThrow(
      'Unknown option: --wat',
    )
  })

  test('finds help after an unknown option enters terminal-only mode', () => {
    expect(() => parseArguments(['--wat', '--help'])).toThrow(
      'Process exited with code 0',
    )
  })

  test('sets boolean config options when provided once', () => {
    parseArguments(['test.md', '--open', '--https-only', '--no-size-check'])
    expect(config.open).toBe(true)
    expect(config.httpsOnly).toBe(true)
    expect(config.skipSizeCheck).toBe(true)
  })

  test('defers browser validation until finalization', () => {
    parseArguments(['test.md', '--browser', 'BrAvE'])
    expect(config.browser).toBe('brave')

    expect(() => parseArguments(['test.md', '--browser'])).toThrow(
      'Browser option requires a value. Supported browsers: default, chrome, firefox, edge, brave.',
    )
    expect(() => parseArguments(['test.md', '--browser', 'safari'])).toThrow(
      'Unsupported browser "safari". Supported browsers: default, chrome, firefox, edge, brave.',
    )
  })

  test('defers theme validation until finalization', () => {
    parseArguments(['test.md', '--theme', 'Dark-Dimmed'])
    expect(config.theme).toBe('dark-dimmed')

    expect(() => parseArguments(['test.md', '--theme'])).toThrow(
      'Theme option requires a value. Supported themes: default, light, dark, dark-dimmed, dark-high-contrast, dark-colorblind, light-colorblind.',
    )
    expect(() => parseArguments(['test.md', '--theme', 'sepia'])).toThrow(
      'Unsupported theme "sepia". Supported themes: default, light, dark, dark-dimmed, dark-high-contrast, dark-colorblind, light-colorblind.',
    )
  })

  test('defers max-size validation until finalization', () => {
    parseArguments(['test.md', '--max-size', '10'])
    expect(config.maxFileSize).toBe(10)

    expect(() => parseArguments(['test.md', '--max-size'])).toThrow(
      'Max size option requires a value.',
    )
    expect(() => parseArguments(['test.md', '--max-size', '0'])).toThrow(
      'Max size must be a positive number.',
    )
    expect(() => parseArguments(['test.md', '--max-size', '-1'])).toThrow(
      'Max size must be a positive number.',
    )
    expect(() => parseArguments(['test.md', '--max-size', 'a'])).toThrow(
      'Max size must be a positive number.',
    )
  })
})
