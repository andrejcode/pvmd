import { renderIcons } from './icons'

const disconnectedAlert = document.getElementById('disconnected-alert')
const closeButton = document.getElementById('alert-close')
let dismissed = false

if (disconnectedAlert) {
  renderIcons(disconnectedAlert)
}

closeButton?.addEventListener('click', () => {
  dismissDisconnectedAlert()
})

function showDisconnectedAlert() {
  if (disconnectedAlert && !dismissed) {
    disconnectedAlert.hidden = false
  }
}

function hideDisconnectedAlert() {
  if (disconnectedAlert) {
    disconnectedAlert.hidden = true
  }
}

function dismissDisconnectedAlert() {
  dismissed = true
  hideDisconnectedAlert()
}

function resetDisconnectedAlert() {
  dismissed = false
  hideDisconnectedAlert()
}

export {
  showDisconnectedAlert,
  hideDisconnectedAlert,
  dismissDisconnectedAlert,
  resetDisconnectedAlert,
}
