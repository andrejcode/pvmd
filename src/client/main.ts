import 'katex/dist/katex.min.css'
import './styles.css'
import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateMessage,
  type LiveUpdateOperation,
} from '@/shared/live-update'
import {
  showDisconnectedAlert,
  resetDisconnectedAlert,
} from './disconnected-alert'
import { renderIcons, createCopyIcon } from './icons'

const markdownContent = document.getElementById('markdown-content')

const watchEnabled = document.body.dataset['watch'] !== 'false'

function addCopyButtons(root: Element) {
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre code'))
  for (const code of codeBlocks) {
    const pre = code.parentElement
    if (!pre) continue

    const button = document.createElement('button')
    button.className = 'copy-button'
    button.ariaLabel = 'Copy code'
    button.appendChild(createCopyIcon())
    renderIcons(button)

    button.addEventListener('click', () => {
      const text = code.textContent ?? ''
      void navigator.clipboard.writeText(text).then(() => {
        button.classList.add('copied')
        setTimeout(() => {
          button.classList.remove('copied')
        }, 2000)
      })
    })

    pre.appendChild(button)
  }
}

function disableInteractiveContent(root: HTMLElement) {
  const controls = root.querySelectorAll<HTMLElement>(
    'button, input, select, textarea',
  )

  for (const control of controls) {
    if (control.classList.contains('copy-button')) {
      continue
    }

    if (
      control instanceof HTMLButtonElement ||
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
    ) {
      control.disabled = true
    }

    control.setAttribute('aria-disabled', 'true')
    control.setAttribute('tabindex', '-1')
  }
}

function openExternalLinksInNewTab(root: HTMLElement) {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href]')
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('http://') || href.startsWith('https://')) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

function applyEnhancements(root: HTMLElement) {
  addCopyButtons(root)
  disableInteractiveContent(root)
  openExternalLinksInNewTab(root)
}

function applyFullHtml(html: string) {
  if (!markdownContent) {
    return
  }

  markdownContent.innerHTML = html
  applyEnhancements(markdownContent)
}

function applyPatch(ops: LiveUpdateOperation[]) {
  if (!markdownContent) {
    return
  }

  // Apply each operation directly against the existing block wrappers so
  // untouched markdown sections stay mounted in the DOM.
  for (const op of ops) {
    if (op.type === 'remove') {
      markdownContent
        .querySelector(`[${LIVE_BLOCK_ATTRIBUTE}="${op.blockId}"]`)
        ?.remove()
      continue
    }

    const block = createBlockElement(op.html)
    if (!block) {
      continue
    }

    if (op.beforeBlockId) {
      const referenceBlock = markdownContent.querySelector(
        `[${LIVE_BLOCK_ATTRIBUTE}="${op.beforeBlockId}"]`,
      )

      if (referenceBlock) {
        markdownContent.insertBefore(block, referenceBlock)
      } else {
        markdownContent.appendChild(block)
      }
    } else {
      markdownContent.appendChild(block)
    }

    applyEnhancements(block)
  }
}

function createBlockElement(html: string): HTMLElement | null {
  const template = document.createElement('template')
  template.innerHTML = html.trim()

  const firstElement = template.content.firstElementChild
  return firstElement instanceof HTMLElement ? firstElement : null
}

function connectLiveUpdates() {
  if (!watchEnabled) {
    return
  }

  const eventSource = new EventSource('/events')

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
      applyFullHtml(message)
      return
    }

    if (message.kind === 'full') {
      applyFullHtml(message.html)
      return
    }

    applyPatch(message.ops)
  }
}

if (markdownContent) {
  applyEnhancements(markdownContent)
}

connectLiveUpdates()
