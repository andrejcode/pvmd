import * as fs from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import {
  config,
  LOCAL_CONFIG_BASENAME,
  LOCAL_CONFIG_DIRECTORY_NAME,
  LOCAL_CONFIG_RELATIVE_PATH,
  parseBrowserValue,
  parseMaxFileSizeValue,
  parsePortValue,
  parseThemeValue,
  type Config,
} from './config'

const CONFIG_KEYS = [
  'port',
  'skipSizeCheck',
  'maxFileSizeMB',
  'watch',
  'httpsOnly',
  'open',
  'browser',
  'theme',
] satisfies Array<keyof Config>

export const fileSystem = {
  existsSync: (path: string) => fs.existsSync(path),
  readFileSync: (path: string) => fs.readFileSync(path, 'utf8'),
}

export const osPaths = {
  homedir: () => homedir(),
}

export function findLocalConfigPath(homeDirectory = osPaths.homedir()) {
  const candidatePath = resolve(
    homeDirectory,
    LOCAL_CONFIG_DIRECTORY_NAME,
    LOCAL_CONFIG_BASENAME,
  )

  if (fileSystem.existsSync(candidatePath)) {
    return candidatePath
  }

  return null
}

export function loadLocalConfig(homeDirectory = osPaths.homedir()) {
  const configPath = findLocalConfigPath(homeDirectory)
  if (!configPath) {
    return null
  }

  let parsedConfig: unknown
  try {
    parsedConfig = JSON.parse(fileSystem.readFileSync(configPath))
  } catch {
    throw new Error(`${LOCAL_CONFIG_RELATIVE_PATH} must be valid JSON.`)
  }

  applyLocalConfig(parsedConfig)
  return configPath
}

export function applyLocalConfig(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${LOCAL_CONFIG_RELATIVE_PATH} must contain a JSON object.`)
  }

  const overrides = value as Record<string, unknown>

  for (const [key, rawValue] of Object.entries(overrides)) {
    switch (key) {
      case 'port':
        config.port = parseConfigNumber(key, rawValue, parsePortValue)
        break
      case 'skipSizeCheck':
        config.skipSizeCheck = parseConfigBoolean(key, rawValue)
        break
      case 'maxFileSizeMB':
        config.maxFileSizeMB = parseConfigNumber(
          key,
          rawValue,
          parseMaxFileSizeValue,
        )
        break
      case 'watch':
        config.watch = parseConfigBoolean(key, rawValue)
        break
      case 'httpsOnly':
        config.httpsOnly = parseConfigBoolean(key, rawValue)
        break
      case 'open':
        config.open = parseConfigBoolean(key, rawValue)
        break
      case 'browser':
        config.browser = parseConfigString(key, rawValue, parseBrowserValue)
        break
      case 'theme':
        config.theme = parseConfigString(key, rawValue, parseThemeValue)
        break
      default:
        throw new Error(
          `Unsupported setting "${key}" in ${LOCAL_CONFIG_RELATIVE_PATH}. Supported settings: ${CONFIG_KEYS.join(', ')}.`,
        )
    }
  }
}

function parseConfigBoolean(key: string, value: unknown) {
  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid setting "${key}" in ${LOCAL_CONFIG_RELATIVE_PATH}. Expected a boolean.`,
    )
  }

  return value
}

function parseConfigNumber<T>(
  key: string,
  value: unknown,
  parse: (value: unknown) => T,
) {
  try {
    return parse(value)
  } catch (error) {
    throw new Error(
      `Invalid setting "${key}" in ${LOCAL_CONFIG_RELATIVE_PATH}. ${(error as Error).message}`,
    )
  }
}

function parseConfigString<T>(
  key: string,
  value: unknown,
  parse: (value: unknown) => T,
) {
  try {
    return parse(value)
  } catch (error) {
    throw new Error(
      `Invalid setting "${key}" in ${LOCAL_CONFIG_RELATIVE_PATH}. ${(error as Error).message}`,
    )
  }
}
