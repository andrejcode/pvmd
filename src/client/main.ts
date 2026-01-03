import 'github-markdown-css/github-markdown.css'
import './styles.css'

const ws = new WebSocket(`ws://${window.location.host}`)
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

ws.onopen = () => {
  hideDisconnectedAlert()
}

ws.onclose = () => {
  showDisconnectedAlert()
}

ws.onerror = () => {
  showDisconnectedAlert()
}

ws.onmessage = (event) => {
  if (markdownContent && typeof event.data === 'string') {
    markdownContent.innerHTML = event.data
  }
}

if (closeAlertButton) {
  closeAlertButton.addEventListener('click', () => {
    hideDisconnectedAlert()
  })
}
