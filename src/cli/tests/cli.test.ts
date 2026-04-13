import { type MockInstance } from 'vitest'
import { config, DEFAULT_CONFIG } from '../config'
import { parseArguments } from '../index'
import { fileSystem, osPaths } from '../local-config'

describe('parseArguments', () => {
  let consoleLogSpy: MockInstance
  let processExitSpy: MockInstance

  beforeEach(() => {
    Object.assign(config, DEFAULT_CONFIG)
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`)
    })
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  test('should print help if --help or -h is provided', () => {
    expect(() => parseArguments(['--help'])).toThrow(
      'Process exited with code 0',
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pvmd [options] <file>'),
    )
    expect(processExitSpy).toHaveBeenCalledWith(0)

    consoleLogSpy.mockClear()
    processExitSpy.mockClear()

    expect(() => parseArguments(['-h'])).toThrow('Process exited with code 0')
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pvmd [options] <file>'),
    )
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  test('should print help with effective defaults from local config', () => {
    const originalExistsSync = fileSystem.existsSync
    const originalReadFileSync = fileSystem.readFileSync
    const originalHomedir = osPaths.homedir
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn(
      (path) => String(path) === '/Users/tester/.pvmd/config.json',
    )
    fileSystem.readFileSync = vi.fn(() => {
      return JSON.stringify({
        port: 8123,
        skipSizeCheck: true,
        maxFileSizeMB: 5,
        watch: false,
        httpsOnly: true,
        open: true,
        browser: 'firefox',
        theme: 'dark',
      })
    })

    expect(() => parseArguments(['--help'])).toThrow(
      'Process exited with code 0',
    )

    const output = consoleLogSpy.mock.calls.flat().join('\n')

    expect(output).toContain(
      'Port number (default: 8123; use 0 for a random available port)',
    )
    expect(output).toContain('Skip file size validation (default: true)')
    expect(output).toContain('Maximum file size in MB (default: 5)')
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

    fileSystem.existsSync = originalExistsSync
    fileSystem.readFileSync = originalReadFileSync
    osPaths.homedir = originalHomedir
  })

  test('should print version if --version or -v is provided', () => {
    const version = '0.0.0'
    vi.stubEnv('PVMD_VERSION', version)

    expect(() => parseArguments(['--version'])).toThrow(
      'Process exited with code 0',
    )

    expect(consoleLogSpy).toHaveBeenCalledWith(`pvmd v${version}`)
    expect(processExitSpy).toHaveBeenCalledWith(0)

    consoleLogSpy.mockClear()
    processExitSpy.mockClear()

    expect(() => parseArguments(['-v'])).toThrow('Process exited with code 0')
    expect(consoleLogSpy).toHaveBeenCalledWith(`pvmd v${version}`)
    expect(processExitSpy).toHaveBeenCalledWith(0)
  })

  test('should throw an error if no arguments are provided', () => {
    expect(() => parseArguments([])).toThrow(
      'Please provide a markdown file path as an argument',
    )
  })

  test('should throw an error if the first argument is empty string', () => {
    expect(() => parseArguments([''])).toThrow(
      'Please provide a markdown file path as an argument',
    )
  })

  test('should return the correct arguments', () => {
    expect(parseArguments(['test.md'])).toBe('test.md')
  })

  test('should load local config before applying CLI flags', () => {
    const originalExistsSync = fileSystem.existsSync
    const originalReadFileSync = fileSystem.readFileSync
    const originalHomedir = osPaths.homedir
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn(
      (path) => String(path) === '/Users/tester/.pvmd/config.json',
    )
    fileSystem.readFileSync = vi.fn(() => {
      return JSON.stringify({
        port: 8123,
        open: true,
        browser: 'firefox',
        theme: 'dark',
      })
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

    fileSystem.existsSync = originalExistsSync
    fileSystem.readFileSync = originalReadFileSync
    osPaths.homedir = originalHomedir
  })

  describe('port option', () => {
    test('should update the config if an option is provided', () => {
      parseArguments(['test.md', '--port', '8080'])
      expect(config.port).toBe(8080)
    })

    test('should allow port 0 to request a random available port', () => {
      parseArguments(['test.md', '--port', '0'])
      expect(config.port).toBe(0)
    })

    test('should throw an error if port number is out of range', () => {
      expect(() => parseArguments(['test.md', '--port', '-1'])).toThrow(
        'Port must be between 0 and 65535',
      )

      expect(() => parseArguments(['test.md', '--port', '70000'])).toThrow(
        'Port must be between 0 and 65535',
      )
    })

    test('should throw an error if port number is not an integer', () => {
      expect(() => parseArguments(['test.md', '--port', '1234.5'])).toThrow(
        'Port must be an integer',
      )
    })

    test('should throw an error if port is blocked by browsers', () => {
      expect(() => parseArguments(['test.md', '--port', '6000'])).toThrow(
        'Port 6000 is blocked by browsers for security reasons. Please choose a different port.',
      )
    })

    test('should throw an error if port number is not provided', () => {
      expect(() => parseArguments(['test.md', '--port'])).toThrow(
        'Port option requires a value',
      )
    })

    test('should update config.port to the latest provided value', () => {
      parseArguments(['test.md', '--port', '8080', '-p', '8081'])
      expect(config.port).toBe(8081)
    })
  })

  describe('https-only option', () => {
    test('should set config.httpsOnly to true when --https-only is provided', () => {
      parseArguments(['test.md', '--https-only'])
      expect(config.httpsOnly).toBe(true)
    })
  })

  describe('open option', () => {
    test('should set config.open to true when --open is provided', () => {
      parseArguments(['test.md', '--open'])
      expect(config.open).toBe(true)
    })

    test('should set config.open to true when -o is provided', () => {
      parseArguments(['test.md', '-o'])
      expect(config.open).toBe(true)
    })
  })

  describe('browser option', () => {
    test('should set config.browser when --browser is provided', () => {
      parseArguments(['test.md', '--browser', 'chrome'])
      expect(config.browser).toBe('chrome')
    })

    test('should set config.browser when -b is provided', () => {
      parseArguments(['test.md', '-b', 'firefox'])
      expect(config.browser).toBe('firefox')
    })

    test('should normalize browser values to lowercase', () => {
      parseArguments(['test.md', '--browser', 'BrAvE'])
      expect(config.browser).toBe('brave')
    })

    test('should throw an error if browser value is not provided', () => {
      expect(() => parseArguments(['test.md', '--browser'])).toThrow(
        'Browser option requires a value. Supported browsers: default, chrome, firefox, edge, brave.',
      )
    })

    test('should throw an error if browser is unsupported', () => {
      expect(() => parseArguments(['test.md', '--browser', 'safari'])).toThrow(
        'Unsupported browser "safari". Supported browsers: default, chrome, firefox, edge, brave.',
      )
    })
  })

  describe('theme option', () => {
    test('should set config.theme when --theme is provided', () => {
      parseArguments(['test.md', '--theme', 'dark'])
      expect(config.theme).toBe('dark')
    })

    test('should set config.theme when -t is provided', () => {
      parseArguments(['test.md', '-t', 'light-colorblind'])
      expect(config.theme).toBe('light-colorblind')
    })

    test('should normalize theme values to lowercase', () => {
      parseArguments(['test.md', '--theme', 'Dark-Dimmed'])
      expect(config.theme).toBe('dark-dimmed')
    })

    test('should throw an error if theme value is not provided', () => {
      expect(() => parseArguments(['test.md', '--theme'])).toThrow(
        'Theme option requires a value. Supported themes: default, light, dark, dark-dimmed, dark-high-contrast, dark-colorblind, light-colorblind.',
      )
    })

    test('should throw an error if theme is unsupported', () => {
      expect(() => parseArguments(['test.md', '--theme', 'sepia'])).toThrow(
        'Unsupported theme "sepia". Supported themes: default, light, dark, dark-dimmed, dark-high-contrast, dark-colorblind, light-colorblind.',
      )
    })
  })

  test('should throw when local config is invalid', () => {
    const originalExistsSync = fileSystem.existsSync
    const originalReadFileSync = fileSystem.readFileSync
    const originalHomedir = osPaths.homedir
    osPaths.homedir = vi.fn(() => '/Users/tester')
    fileSystem.existsSync = vi.fn(
      (path) => String(path) === '/Users/tester/.pvmd/config.json',
    )
    fileSystem.readFileSync = vi.fn(() => '{invalid json')

    expect(() => parseArguments(['test.md'])).toThrow(
      '.pvmd/config.json must be valid JSON.',
    )

    fileSystem.existsSync = originalExistsSync
    fileSystem.readFileSync = originalReadFileSync
    osPaths.homedir = originalHomedir
  })

  describe('size options', () => {
    test('should update the config if an option is provided', () => {
      parseArguments(['test.md', '--no-size-check'])
      expect(config.skipSizeCheck).toBe(true)
    })

    test('should throw an error if max size is not positive number', () => {
      expect(() => parseArguments(['test.md', '--max-size', '0'])).toThrow(
        'Max size must be a positive number',
      )

      expect(() => parseArguments(['test.md', '--max-size', '-1'])).toThrow(
        'Max size must be a positive number',
      )
    })

    test('should throw an error if max size is not valid', () => {
      expect(() => parseArguments(['test.md', '--max-size', 'a'])).toThrow(
        'Max size must be a positive number',
      )
    })

    test('should throw an error if max size number is not provided', () => {
      expect(() => parseArguments(['test.md', '--max-size'])).toThrow(
        'Max size option requires a value',
      )
    })

    test('should update the config if an option is provided', () => {
      parseArguments(['test.md', '--max-size', '10'])
      expect(config.maxFileSizeMB).toBe(10)
    })
  })
})
