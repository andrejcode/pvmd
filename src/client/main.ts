import 'github-markdown-css/github-markdown.css'
import './styles.css'

const ws = new WebSocket(`ws://${window.location.host}`)
const mainElement = document.getElementById('markdown-content')

ws.onmessage = (event) => {
  if (mainElement && typeof event.data === 'string') {
    mainElement.innerHTML = event.data
  }
}
