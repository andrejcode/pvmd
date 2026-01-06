import { vi } from 'vitest'
import { parseArguments } from '../index'

describe('parseArguments', () => {
  test('should print help if --help or -h is provided', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    parseArguments(['--help'])
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pvmd [options] <file>'),
    )
    expect(processExitSpy).toHaveBeenCalledWith(0)

    consoleLogSpy.mockClear()
    processExitSpy.mockClear()

    parseArguments(['-h'])
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: pvmd [options] <file>'),
    )
    expect(processExitSpy).toHaveBeenCalledWith(0)

    consoleLogSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  test('should print version if --version or -v is provided', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    parseArguments(['--version'])
    expect(consoleLogSpy).toHaveBeenCalledWith('pvmd v0.0.0')
    expect(processExitSpy).toHaveBeenCalledWith(0)

    consoleLogSpy.mockClear()
    processExitSpy.mockClear()

    parseArguments(['-v'])
    expect(consoleLogSpy).toHaveBeenCalledWith('pvmd v0.0.0')
    expect(processExitSpy).toHaveBeenCalledWith(0)

    consoleLogSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  test('should throw error if no arguments are provided', () => {
    expect(() => parseArguments([])).toThrow(
      'Please provide a markdown file path as argument.\nUsage: pvmd <file.md>',
    )
  })

  test('should throw error if the first argument is empty string', () => {
    expect(() => parseArguments([''])).toThrow(
      'Please provide a markdown file path as argument.\nUsage: pvmd <file.md>',
    )
  })

  test('should return the correct arguments', () => {
    expect(parseArguments(['test.md'])).toEqual({
      userPath: 'test.md',
    })
  })
})
