import 'github-markdown-css/github-markdown.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateMessage,
  type LiveUpdateOperation,
} from '@/shared/live-update'

const eventSource = new EventSource('/events')
const markdownContent = document.getElementById('markdown-content')
const disconnectedAlert = document.getElementById('disconnected-alert')
const closeAlertButton = document.getElementById('alert-close')
const copyIconTemplate = document.getElementById(
  'icon-copy',
) as HTMLTemplateElement | null

type EnhancementRoot = ParentNode & {
  querySelectorAll: ParentNode['querySelectorAll']
}

function showDisconnectedAlert() {
  if (disconnectedAlert) {
    disconnectedAlert.hidden = false
  }
}

function hideDisconnectedAlert() {
  if (disconnectedAlert) {
    disconnectedAlert.hidden = true
  }
}

const httpsOnly = document.body.hasAttribute('data-https-only')

function addCopyButtons(root: EnhancementRoot) {
  if (!copyIconTemplate) return

  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre code'))
  for (const code of codeBlocks) {
    const pre = code.parentElement
    if (!pre) continue

    const button = document.createElement('button')
    button.className = 'copy-button'
    button.ariaLabel = 'Copy code'
    button.appendChild(copyIconTemplate.content.cloneNode(true))

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

function disableInteractiveContent(root: EnhancementRoot) {
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

function blockInsecureContent(root: EnhancementRoot) {
  if (!httpsOnly) return

  const links = root.querySelectorAll<HTMLAnchorElement>('a[href]')
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('http://')) {
      link.removeAttribute('href')
      link.setAttribute('role', 'link')
      link.setAttribute('aria-disabled', 'true')
      link.title = 'Blocked: HTTP links are not allowed in HTTPS-only mode'
    }
  }

  const images = root.querySelectorAll<HTMLImageElement>('img[src]')
  for (const img of images) {
    const src = img.getAttribute('src') ?? ''
    if (src.startsWith('http://')) {
      img.remove()
    }
  }
}

function openExternalLinksInNewTab(root: EnhancementRoot) {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href]')
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('http://') || href.startsWith('https://')) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

function applyEnhancements(root: EnhancementRoot) {
  addCopyButtons(root)
  disableInteractiveContent(root)
  openExternalLinksInNewTab(root)
  blockInsecureContent(root)
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

eventSource.onopen = () => {
  hideDisconnectedAlert()
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

if (closeAlertButton) {
  closeAlertButton.addEventListener('click', () => {
    hideDisconnectedAlert()
  })
}

if (markdownContent) {
  applyEnhancements(markdownContent)
}
