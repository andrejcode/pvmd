import { watch, type FSWatcher } from 'node:fs'
import {
  readMarkdownFile,
  renderMarkdownBlocks,
  validateMarkdownPath,
} from '@/markdown'
import { exitWithError } from '@/utils/fatal-error'
import { createLivePreview } from './live-preview'

export default function createWatcher(path: string, httpsOnly = false) {
  const debounceMs = 200
  const renameRetryDelayMs = 50
  const renameRetryLimit = 10
  const preview = createLivePreview()
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let renameRetryTimer: ReturnType<typeof setTimeout> | null = null
  let watcher: FSWatcher | null = null
  let isClosed = false

  function cancelScheduledReload() {
    if (!reloadTimer) {
      return
    }

    clearTimeout(reloadTimer)
    reloadTimer = null
  }

  function cancelRenameRetry() {
    if (!renameRetryTimer) {
      return
    }

    clearTimeout(renameRetryTimer)
    renameRetryTimer = null
  }

  function closeWatcher() {
    watcher?.close()
    watcher = null
  }

  function closeClients() {
    preview.cleanup()
  }

  function exitOnWatcherError(error: unknown): never {
    cancelScheduledReload()
    cancelRenameRetry()
    isClosed = true
    closeWatcher()
    closeClients()

    exitWithError(error)
  }

  function broadcastUpdate() {
    if (!preview.hasClients()) {
      return
    }

    try {
      const content = readMarkdownFile(path)
      const nextBlocks = renderMarkdownBlocks(content, httpsOnly)
      preview.update(nextBlocks)
    } catch (error) {
      exitOnWatcherError(error)
    }
  }

  function scheduleReload() {
    if (!preview.hasClients()) {
      return
    }

    cancelScheduledReload()
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      broadcastUpdate()
    }, debounceMs)
  }

  function attachWatcher() {
    if (isClosed) {
      return
    }

    watcher = watch(path, handleWatchEvent)
  }

  function recoverWatcher(attempt: number) {
    if (isClosed) {
      return
    }

    try {
      validateMarkdownPath(path)
      attachWatcher()
      scheduleReload()
    } catch (error) {
      if (attempt >= renameRetryLimit - 1) {
        exitOnWatcherError(error)
      }

      renameRetryTimer = setTimeout(() => {
        renameRetryTimer = null
        recoverWatcher(attempt + 1)
      }, renameRetryDelayMs)
    }
  }

  function handleWatchEvent(event: 'rename' | 'change') {
    if (event === 'rename') {
      cancelScheduledReload()
      closeWatcher()
      recoverWatcher(0)
      return
    }

    scheduleReload()
  }

  attachWatcher()

  return {
    handleSSE: preview.handleSSE,
    cleanup: () => {
      cancelScheduledReload()
      cancelRenameRetry()
      isClosed = true
      closeWatcher()
      closeClients()
    },
  }
}
