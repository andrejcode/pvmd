import { type Config } from './config'
import { loadLocalConfigWithBlockedKeys } from './local-config'
import {
  formatOptionName,
  resolveOption,
  showHelp,
  type Option,
} from './options'

interface ScheduledAssignment {
  name: string
  option: Option
  value?: string
}

interface ParseState {
  fatalError: Error | null
  requestedHelp: boolean
  requestedVersion: boolean
  scheduledAssignments: ScheduledAssignment[]
  seenNormalOptions: Set<string>
  blockedLocalConfigKeys: Set<keyof Config>
  skipLocalConfig: boolean
  terminalOnly: boolean
  userPath: string | null
}

function createParseState(): ParseState {
  return {
    fatalError: null,
    requestedHelp: false,
    requestedVersion: false,
    scheduledAssignments: [],
    seenNormalOptions: new Set(),
    blockedLocalConfigKeys: new Set(),
    skipLocalConfig: false,
    terminalOnly: false,
    userPath: null,
  }
}

function setFatalError(state: ParseState, error: Error) {
  if (state.fatalError) {
    return
  }

  state.fatalError = error
  state.terminalOnly = true
}

function recordTerminalAction(state: ParseState, arg: string) {
  if (arg === '--help' || arg === '-h') {
    state.requestedHelp = true
    return
  }

  if (arg === '--version' || arg === '-v') {
    state.requestedVersion = true
    return
  }

  if (arg === '--no-local-config') {
    state.skipLocalConfig = true
  }
}

function createMissingValueError(name: string, option: Option) {
  try {
    option.action?.(undefined)
  } catch (error) {
    return error as Error
  }

  return new Error(`${formatOptionName(name)} requires a value.`)
}

function createDuplicateOptionError(name: string) {
  return new Error(
    `Option "${formatOptionName(name)}" was provided multiple times.`,
  )
}

function showVersion() {
  if (process.env['NODE_ENV'] === 'development') {
    console.log('pvmd development')
  } else {
    console.log(`pvmd v${process.env['PVMD_VERSION']}`)
  }
}

function applyScheduledAssignments(state: ParseState, suppressErrors: boolean) {
  for (const assignment of state.scheduledAssignments) {
    try {
      assignment.option.action?.(assignment.value)
    } catch (error) {
      if (!suppressErrors) {
        throw error
      }
    }
  }
}

export function parseArguments(args: string[]) {
  const state = createParseState()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue

    if (state.terminalOnly) {
      recordTerminalAction(state, arg)
      continue
    }

    let resolvedOption
    try {
      resolvedOption = resolveOption(arg)
    } catch (error) {
      setFatalError(state, error as Error)
      continue
    }

    if (resolvedOption) {
      const { name, option } = resolvedOption

      if (option.kind === 'terminal') {
        if (option.terminalAction === 'help') {
          state.requestedHelp = true
        } else if (option.terminalAction === 'version') {
          state.requestedVersion = true
        }

        continue
      }

      if (state.seenNormalOptions.has(name)) {
        setFatalError(state, createDuplicateOptionError(name))
        continue
      }

      state.seenNormalOptions.add(name)

      if (name === 'no-local-config') {
        state.skipLocalConfig = true
        continue
      }

      if (option.configKey) {
        state.blockedLocalConfigKeys.add(option.configKey)
      }

      if (option.takesValue) {
        const value = args[i + 1]

        if (value === undefined || value === '') {
          setFatalError(state, createMissingValueError(name, option))
          continue
        }

        state.scheduledAssignments.push({ name, option, value })
        i++
        continue
      }

      state.scheduledAssignments.push({ name, option })
      continue
    }

    if (!state.userPath) {
      state.userPath = arg
      continue
    }

    setFatalError(
      state,
      new Error('Only one markdown file path may be provided.'),
    )
  }

  if (state.requestedHelp) {
    if (!state.skipLocalConfig) {
      loadLocalConfigWithBlockedKeys(state.blockedLocalConfigKeys)
    }

    applyScheduledAssignments(state, true)
    showHelp()
    process.exit(0)
  }

  if (state.requestedVersion) {
    showVersion()
    process.exit(0)
  }

  if (state.fatalError) {
    throw state.fatalError
  }

  if (!state.skipLocalConfig) {
    loadLocalConfigWithBlockedKeys(state.blockedLocalConfigKeys)
  }

  applyScheduledAssignments(state, false)

  if (!state.userPath) {
    throw new Error('Please provide a markdown file path as an argument')
  }

  return state.userPath
}
