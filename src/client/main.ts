import 'github-markdown-css/github-markdown.css'
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
  }
}

if (closeAlertButton) {
  closeAlertButton.addEventListener('click', () => {
    hideDisconnectedAlert()
  })
}

addCopyButtons()
