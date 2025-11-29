const ws = new WebSocket(`ws://${window.location.host}`)
const main = document.getElementById('markdown')

ws.onmessage = (event) => {
  if (main && typeof event.data === 'string') {
    main.innerHTML = event.data
  }
}
