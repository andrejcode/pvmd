import darkColorblind from 'github-markdown-css/github-markdown-dark-colorblind.css?raw'
import darkDimmed from 'github-markdown-css/github-markdown-dark-dimmed.css?raw'
import darkHighContrast from 'github-markdown-css/github-markdown-dark-high-contrast.css?raw'
import dark from 'github-markdown-css/github-markdown-dark.css?raw'
import lightColorblind from 'github-markdown-css/github-markdown-light-colorblind.css?raw'
import light from 'github-markdown-css/github-markdown-light.css?raw'

const { initializeMock, runMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  runMock: vi.fn<(options: { nodes: HTMLElement[] }) => Promise<void>>(),
}))

vi.mock('mermaid', () => ({
  default: { initialize: initializeMock, run: runMock },
}))

const themeStyles: Record<string, string> = {
  light,
  dark,
  'dark-dimmed': darkDimmed,
  'dark-high-contrast': darkHighContrast,
  'dark-colorblind': darkColorblind,
  'light-colorblind': lightColorblind,
}

describe('mermaid diagrams', () => {
  let stylesheet: HTMLStyleElement
  let preference: EventTarget

  function setTheme(theme: string) {
    const css = themeStyles[theme]
    if (!css) throw new Error(`Unknown test theme: ${theme}`)
    stylesheet.textContent = css
  }

  function addDiagram(source = 'graph TD\n  A-->B') {
    const node = document.createElement('pre')
    node.className = 'mermaid'
    node.textContent = source
    document.body.appendChild(node)
    return node
  }

  beforeEach(() => {
    vi.resetModules()
    initializeMock.mockReset()
    runMock.mockReset()
    runMock.mockImplementation(({ nodes }) => {
      for (const node of nodes) {
        node.setAttribute('data-processed', 'true')
        node.innerHTML = '<svg><text>Rendered diagram</text></svg>'
      }
      return Promise.resolve()
    })
    document.body.innerHTML = ''
    document.body.className = 'markdown-body'
    stylesheet = document.createElement('style')
    document.head.appendChild(stylesheet)
    setTheme('light')
    preference = new EventTarget()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => preference),
    )
  })

  afterEach(() => {
    stylesheet.remove()
    document.body.className = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test.each([
    ['light', '#ffffff', '#f6f8fa', '#1f2328', '#0969da'],
    ['dark', '#0d1117', '#151b23', '#f0f6fc', '#4493f8'],
    ['dark-dimmed', '#212830', '#262c36', '#f0f6fc', '#478be6'],
    ['dark-high-contrast', '#010409', '#151b23', '#ffffff', '#74b9ff'],
    ['dark-colorblind', '#0d1117', '#151b23', '#f0f6fc', '#4493f8'],
    ['light-colorblind', '#ffffff', '#f6f8fa', '#1f2328', '#0969da'],
  ])(
    'uses the %s Markdown palette',
    async (theme, background, surface, text, accent) => {
      setTheme(theme)
      const node = addDiagram()
      const { renderMermaidDiagrams } = await import('../mermaid-diagrams')

      renderMermaidDiagrams(document.body)

      await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(1))
      expect(node.querySelector('svg')).not.toBeNull()
      expect(initializeMock.mock.calls[0]?.[0]).toMatchObject({
        theme: 'base',
        look: 'classic',
        securityLevel: 'strict',
        fontFamily: getComputedStyle(document.body).fontFamily,
        themeVariables: {
          background,
          primaryColor: surface,
          primaryTextColor: text,
          primaryBorderColor: accent,
          actorBkg: surface,
          actorTextColor: text,
          signalColor: text,
          noteTextColor: text,
        },
      })
    },
  )

  test('re-renders original source on light/dark changes, including live-added blocks', async () => {
    const first = addDiagram()
    const { renderMermaidDiagrams } = await import('../mermaid-diagrams')
    renderMermaidDiagrams(document.body)
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(1))

    const second = addDiagram('sequenceDiagram\n  Alice->>Bob: Hello')
    renderMermaidDiagrams(document.body)
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(2))
    expect(initializeMock).toHaveBeenCalledTimes(1)

    runMock.mockImplementation(({ nodes }) => {
      expect(nodes[0]?.hasAttribute('data-processed')).toBe(false)
      expect(nodes[0]?.textContent).toBe(
        nodes[0] === first
          ? 'graph TD\n  A-->B'
          : 'sequenceDiagram\n  Alice->>Bob: Hello',
      )
      nodes[0]!.setAttribute('data-processed', 'true')
      nodes[0]!.innerHTML = '<svg></svg>'
      return Promise.resolve()
    })

    setTheme('dark')
    preference.dispatchEvent(new Event('change'))
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(4))
    expect(initializeMock).toHaveBeenCalledTimes(2)
    expect(first.querySelector('svg')).not.toBeNull()
    expect(second.querySelector('svg')).not.toBeNull()

    setTheme('light')
    preference.dispatchEvent(new Event('change'))
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(6))
    expect(initializeMock).toHaveBeenCalledTimes(3)
  })

  test('keeps fixed themes unchanged and skips detached or already processed diagrams', async () => {
    setTheme('dark-dimmed')
    const node = addDiagram()
    const detached = addDiagram()
    const processed = addDiagram()
    processed.setAttribute('data-processed', 'true')
    const { renderMermaidDiagrams } = await import('../mermaid-diagrams')

    renderMermaidDiagrams(document.body)
    detached.remove()
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(1))
    preference.dispatchEvent(new Event('change'))
    renderMermaidDiagrams(document.body)
    // Queue a new diagram so completion also verifies the preceding no-op tasks.
    const added = addDiagram()
    renderMermaidDiagrams(document.body)
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(2))
    expect(runMock.mock.calls.map(([options]) => options.nodes)).toEqual([
      [node],
      [added],
    ])
    expect(initializeMock).toHaveBeenCalledTimes(1)
  })

  test('serializes a theme switch during rendering and restores failed diagram source', async () => {
    const node = addDiagram()
    let finishRender: (() => void) | undefined
    runMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRender = resolve
        }),
    )
    const { renderMermaidDiagrams } = await import('../mermaid-diagrams')
    renderMermaidDiagrams(document.body)
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(1))

    setTheme('dark')
    preference.dispatchEvent(new Event('change'))
    expect(initializeMock).toHaveBeenCalledTimes(1)
    const error = new Error('Invalid diagram')
    runMock.mockRejectedValueOnce(error)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    finishRender!()

    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        'Unable to render Mermaid diagram:',
        error,
      ),
    )
    expect(initializeMock).toHaveBeenCalledTimes(2)
    expect(node.textContent).toBe('graph TD\n  A-->B')
    expect(node.querySelector('svg')).toBeNull()
  })
})
