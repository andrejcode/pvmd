import {
  type LiveUpdateMessage,
  type LiveUpdateOperation,
  type ScrollUpdateMessage,
} from '@/shared/live-update'
import {
  resetDisconnectedAlert,
  showDisconnectedAlert,
} from './disconnected-alert'

interface LiveUpdatesOptions {
  enabled: boolean
  url?: string
  onFullHtml: (html: string) => void
  onPatch: (ops: LiveUpdateOperation[]) => void
  onScroll?: (message: ScrollUpdateMessage) => void
}

export function connectLiveUpdates({
  enabled,
  url = '/events',
  onFullHtml,
  onPatch,
  onScroll,
}: LiveUpdatesOptions): EventSource | null {
  if (!enabled) {
    return null
  }

  const eventSource = new EventSource(url)

  eventSource.onopen = () => {
    resetDisconnectedAlert()
  }

  eventSource.onerror = () => {
    showDisconnectedAlert()
  }

  eventSource.onmessage = (event) => {
    if (typeof event.data !== 'string') {
      return
    }

    const message = JSON.parse(event.data) as LiveUpdateMessage | string

    if (typeof message === 'string') {
      onFullHtml(message)
      return
    }

    if (message.kind === 'full') {
      onFullHtml(message.html)
      return
    }

    if (message.kind === 'scroll') {
      onScroll?.(message)
      return
    }

    onPatch(message.ops)
  }

  return eventSource
}
