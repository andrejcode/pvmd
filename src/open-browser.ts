import { execFile } from 'node:child_process'
import { config, type BrowserOption } from './cli/config'

type OpenAppName = string | readonly string[]

class BrowserUnavailableError extends Error {}

function formatBrowserLabel(browser: BrowserOption): string {
  return browser === 'default' ? 'the default browser' : browser
}

function getAppCandidates(appName: OpenAppName): string[] {
  return typeof appName === 'string' ? [appName] : Array.from(appName)
}

function execFileAsync(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Browser availability check failed'),
        )
        return
      }

      resolve()
    })
  })
}

async function isInstalledBrowserCandidate(appName: string): Promise<boolean> {
  try {
    if (process.platform === 'darwin') {
      await execFileAsync('open', ['-Ra', appName])
      return true
    }

    if (process.platform === 'linux') {
      await execFileAsync('which', [appName])
      return true
    }

    if (process.platform === 'win32') {
      await execFileAsync('where', [appName])
      return true
    }
  } catch {
    return false
  }

  return true
}

async function ensureConfiguredBrowserAvailable(
  browser: BrowserOption,
  appName: OpenAppName,
): Promise<void> {
  if (browser === 'default') {
    return
  }

  const candidates = getAppCandidates(appName)

  for (const candidate of candidates) {
    if (await isInstalledBrowserCandidate(candidate)) {
      return
    }
  }

  throw new BrowserUnavailableError(
    `The selected browser "${browser}" is not installed or is not available on this system.`,
  )
}

export default async function openPreviewInBrowser(url: string): Promise<void> {
  try {
    const { default: open, apps } = await import('open')

    if (config.browser === 'default') {
      await open(url)
      return
    }

    const appName = apps[config.browser]

    await ensureConfiguredBrowserAvailable(config.browser, appName)
    await open(url, { app: { name: appName } })
  } catch (error) {
    if (error instanceof BrowserUnavailableError) {
      console.warn(
        `${error.message} Use the preview address above to open it manually.`,
      )
      return
    }

    console.warn(
      `Failed to open ${formatBrowserLabel(config.browser)} automatically. Use the preview address above to open it manually.`,
    )
  }
}
