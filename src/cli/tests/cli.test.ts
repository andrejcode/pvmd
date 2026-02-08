import { type MockInstance } from 'vitest'
import { config } from '../config'
import { parseArguments } from '../index'

describe('parseArguments', () => {
  let consoleLogSpy: MockInstance
  let processExitSpy: MockInstance

  beforeEach(() => {
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

  test('should throw error if no arguments are provided', () => {
    expect(() => parseArguments([])).toThrow(
      'Please provide a markdown file path as an argument',
    )
  })

  test('should throw error if the first argument is empty string', () => {
    expect(() => parseArguments([''])).toThrow(
      'Please provide a markdown file path as an argument',
    )
  })

  test('should return the correct arguments', () => {
    expect(parseArguments(['test.md'])).toBe('test.md')
  })

  describe('port option', () => {
    test('should update the config if an option is provided', () => {
      parseArguments(['test.md', '--port', '8080'])
      expect(config.port).toBe(8080)
    })

    test('should throw error if port number is not valid', () => {
      expect(() => parseArguments(['test.md', '--port', '0'])).toThrow(
        'Port must be between 1024 and 49151',
      )
    })

    test('should throw error if port number is not provided', () => {
      expect(() => parseArguments(['test.md', '--port'])).toThrow(
        'Port option requires a value',
      )
    })

    test('should update config.port to the latest provided value', () => {
      parseArguments(['test.md', '--port', '8080', '-p', '8081'])
      expect(config.port).toBe(8081)
    })
  })

  describe('size options', () => {
    test('should update the config if an option is provided', () => {
      parseArguments(['test.md', '--no-size-check'])
      expect(config.skipSizeCheck).toBe(true)
    })

    test('should throw error if max size is not positive number', () => {
      expect(() => parseArguments(['test.md', '--max-size', '0'])).toThrow(
        'Max size must be a positive number',
      )

      expect(() => parseArguments(['test.md', '--max-size', '-1'])).toThrow(
        'Max size must be a positive number',
      )
    })

    test('should throw error if max size is not valid', () => {
      expect(() => parseArguments(['test.md', '--max-size', 'a'])).toThrow(
        'Max size must be a positive number',
      )
    })

    test('should throw error if max size number is not provided', () => {
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
