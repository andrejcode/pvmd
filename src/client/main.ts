import 'github-markdown-css/github-markdown.css'
import './styles.css'

const eventSource = new EventSource('/events')
const markdownContent = document.getElementById('markdown-content')
const disconnectedAlert = document.getElementById('disconnected-alert')
const closeAlertButton = document.getElementById('alert-close')

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

eventSource.onopen = () => {
  hideDisconnectedAlert()
}

eventSource.onerror = () => {
  showDisconnectedAlert()
}

eventSource.onmessage = (event) => {
  if (markdownContent && typeof event.data === 'string') {
    markdownContent.innerHTML = JSON.parse(event.data) as string
  }
}

if (closeAlertButton) {
  closeAlertButton.addEventListener('click', () => {
    hideDisconnectedAlert()
  })
}
