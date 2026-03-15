import 'github-markdown-css/github-markdown.css'
import 'katex/dist/katex.min.css'
import './styles.css'

const eventSource = new EventSource('/events')
const markdownContent = document.getElementById('markdown-content')
const disconnectedAlert = document.getElementById('disconnected-alert')
const closeAlertButton = document.getElementById('alert-close')
const copyIconTemplate = document.getElementById(
  'icon-copy',
) as HTMLTemplateElement | null

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

function addCopyButtons() {
  if (!copyIconTemplate || !markdownContent) return

  const codeBlocks = Array.from(
    markdownContent.querySelectorAll<HTMLElement>('pre code'),
  )
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

function blockInsecureContent() {
  if (!httpsOnly || !markdownContent) return

  const links = markdownContent.querySelectorAll<HTMLAnchorElement>('a[href]')
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('http://')) {
      link.removeAttribute('href')
      link.setAttribute('role', 'link')
      link.setAttribute('aria-disabled', 'true')
      link.title = 'Blocked: HTTP links are not allowed in HTTPS-only mode'
    }
  }

  const images = markdownContent.querySelectorAll<HTMLImageElement>('img[src]')
  for (const img of images) {
    const src = img.getAttribute('src') ?? ''
    if (src.startsWith('http://')) {
      img.remove()
    }
  }
}

function openExternalLinksInNewTab() {
  if (!markdownContent) return

  const links = markdownContent.querySelectorAll<HTMLAnchorElement>('a[href]')
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('http://') || href.startsWith('https://')) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

eventSource.onopen = () => {
  hideDisconnectedAlert()
}

eventSource.onerror = () => {
  showDisconnectedAlert()
}

eventSource.onmessage = (event) => {
  if (markdownContent && typeof event.data === 'string') {
    markdownContent.innerHTML = JSON.parse(event.data) as string
    addCopyButtons()
    openExternalLinksInNewTab()
    blockInsecureContent()
  }
}

if (closeAlertButton) {
  closeAlertButton.addEventListener('click', () => {
    hideDisconnectedAlert()
  })
}

addCopyButtons()
openExternalLinksInNewTab()
blockInsecureContent()
