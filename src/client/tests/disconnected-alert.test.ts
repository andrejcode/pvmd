describe('disconnected alert', () => {
  const ALERT_HTML = `
    <div id="disconnected-alert" hidden>
      <span id="alert-message">Connection lost. Waiting to reconnect...</span>
      <button id="alert-close" type="button" aria-label="Close alert">
        <i data-lucide="x"></i>
      </button>
    </div>
  `

  async function loadDisconnectedAlert() {
    return import('../disconnected-alert')
  }

  beforeEach(() => {
    document.body.innerHTML = ALERT_HTML
    vi.resetModules()
  })

  test('renders the close icon', async () => {
    await loadDisconnectedAlert()

    expect(
      document.querySelector('#alert-close svg[data-lucide="x"]'),
    ).toBeTruthy()
  })

  test('shows and hides the alert', async () => {
    const { showDisconnectedAlert, hideDisconnectedAlert } =
      await loadDisconnectedAlert()
    const alert = document.getElementById('disconnected-alert')

    showDisconnectedAlert()
    expect(alert?.hidden).toBe(false)

    hideDisconnectedAlert()
    expect(alert?.hidden).toBe(true)
  })

  test('hides the alert when the close button is clicked', async () => {
    const { showDisconnectedAlert } = await loadDisconnectedAlert()
    const alert = document.getElementById('disconnected-alert')

    showDisconnectedAlert()
    document.getElementById('alert-close')?.click()

    expect(alert?.hidden).toBe(true)
  })

  test('does not show dismissed alert until it is reset', async () => {
    const { showDisconnectedAlert, resetDisconnectedAlert } =
      await loadDisconnectedAlert()
    const alert = document.getElementById('disconnected-alert')

    showDisconnectedAlert()
    document.getElementById('alert-close')?.click()
    showDisconnectedAlert()
    expect(alert?.hidden).toBe(true)

    resetDisconnectedAlert()
    showDisconnectedAlert()
    expect(alert?.hidden).toBe(false)
  })
})
