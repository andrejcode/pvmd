import { parseArguments } from '../cli'

describe('parseArguments', () => {
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
