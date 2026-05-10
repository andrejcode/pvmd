import { renderIcons } from './icons'

const disconnectedAlert = document.getElementById('disconnected-alert')
const closeButton = document.getElementById('alert-close')

if (disconnectedAlert) {
  renderIcons(disconnectedAlert)
}

closeButton?.addEventListener('click', () => {
  hideDisconnectedAlert()
})

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

export { showDisconnectedAlert, hideDisconnectedAlert }
