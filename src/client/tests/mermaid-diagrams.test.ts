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
  let renderedSources: string[]

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

  function block(id: string, label: string) {
    return `<div data-pvmd-block-id="${id}"><pre class="mermaid">graph TD\n  A[${label}]</pre></div>`
  }

  async function createUpdater() {
    const { renderMermaidDiagrams } = await import('../mermaid-diagrams')
    const { createMarkdownContentUpdater } =
      await import('../markdown-content-updater')
    const root = document.createElement('main')
    document.body.appendChild(root)
    return {
      root,
      updater: createMarkdownContentUpdater(root, {
        applyEnhancements: renderMermaidDiagrams,
      }),
    }
  }

  beforeEach(() => {
    vi.resetModules()
    initializeMock.mockReset()
    runMock.mockReset()
    renderedSources = []
    runMock.mockImplementation(({ nodes }) => {
      for (const node of nodes) {
        renderedSources.push(node.textContent ?? '')
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
    expect(renderedSources).toEqual([
      'graph TD\n  A-->B',
      'sequenceDiagram\n  Alice->>Bob: Hello',
      'graph TD\n  A-->B',
      'sequenceDiagram\n  Alice->>Bob: Hello',
      'graph TD\n  A-->B',
      'sequenceDiagram\n  Alice->>Bob: Hello',
    ])
  })

  test('keeps fixed themes unchanged and skips detached or already processed diagrams', async () => {
    setTheme('dark-dimmed')
    const node = addDiagram('graph TD\n  A-->B')
    const detached = addDiagram('graph TD\n  Detached-->B')
    const processed = addDiagram()
    processed.setAttribute('data-processed', 'true')
    const { renderMermaidDiagrams } = await import('../mermaid-diagrams')

    renderMermaidDiagrams(document.body)
    detached.remove()
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(1))
    preference.dispatchEvent(new Event('change'))
    renderMermaidDiagrams(document.body)
    // Queue a new diagram so completion also verifies the preceding no-op tasks.
    const added = addDiagram('graph TD\n  Added-->B')
    renderMermaidDiagrams(document.body)
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(2))
    expect(renderedSources).toEqual([
      'graph TD\n  A-->B',
      'graph TD\n  Added-->B',
    ])
    expect(node.querySelector('svg')).not.toBeNull()
    expect(added.querySelector('svg')).not.toBeNull()
    expect(initializeMock).toHaveBeenCalledTimes(1)
  })

  test('serializes a theme switch during rendering and restores failed diagram source', async () => {
    const node = addDiagram()
    let finishRender: (() => void) | undefined
    runMock.mockImplementationOnce(
      ({ nodes }) =>
        new Promise<void>((resolve) => {
          finishRender = () => {
            nodes[0]!.innerHTML = '<svg><text>Old theme</text></svg>'
            resolve()
          }
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
    expect(node.firstChild?.textContent).toBe('graph TD\n  A-->B')
    expect(node.querySelector('svg')).toBeNull()
    expect(node.querySelector('.mermaid-error-title')?.textContent).toBe(
      'pvmd: Mermaid error',
    )
    expect(node.querySelector('.mermaid-error-description')?.textContent).toBe(
      'Unable to render diagram.',
    )
  })

  test.each(['patch', 'full'])(
    'keeps the existing SVG mounted during a %s replacement',
    async (mode) => {
      const { root, updater } = await createUpdater()
      updater.applyFullHtml(block('old', 'Old'))
      await vi.waitFor(() => expect(root.querySelector('svg')).not.toBeNull())
      const previous = root.querySelector('svg')!
      let finish: (() => void) | undefined
      runMock.mockImplementationOnce(
        ({ nodes }) =>
          new Promise<void>((resolve) => {
            finish = () => {
              nodes[0]!.innerHTML = '<svg><text>New diagram</text></svg>'
              resolve()
            }
          }),
      )

      if (mode === 'patch') {
        updater.applyPatch([
          { type: 'remove', blockId: 'old' },
          { type: 'insert', html: block('new', 'New') },
        ])
      } else {
        updater.applyFullHtml(block('new', 'New'))
      }

      expect(root.querySelector('svg')).toBe(previous)
      await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(2))
      expect(previous.isConnected).toBe(true)
      expect(root.querySelector('pre')?.getAttribute('aria-busy')).toBe('true')
      const staging = document.querySelector('[data-pvmd-mermaid-staging]')
      expect(staging?.closest('[aria-hidden="true"]')).not.toBeNull()
      expect(root.contains(staging)).toBe(false)

      finish!()
      await vi.waitFor(() =>
        expect(root.querySelector('svg')?.textContent).toBe('New diagram'),
      )
      expect(previous.isConnected).toBe(false)
      expect(root.querySelector('pre')?.hasAttribute('aria-busy')).toBe(false)
      expect(document.querySelector('.mermaid-render-container')).toBeNull()
    },
  )

  test('coalesces rapid edits and never commits a superseded result', async () => {
    const { root, updater } = await createUpdater()
    updater.applyFullHtml(block('first', 'First'))
    await vi.waitFor(() => expect(root.querySelector('svg')).not.toBeNull())
    const previous = root.querySelector('svg')
    const finishes: Array<() => void> = []
    runMock.mockImplementation(({ nodes }) => {
      const source = nodes[0]!.textContent ?? ''
      renderedSources.push(source)
      return new Promise<void>((resolve) => {
        finishes.push(() => {
          nodes[0]!.innerHTML = '<svg></svg>'
          nodes[0]!.querySelector('svg')!.textContent = source
          resolve()
        })
      })
    })
    function replace(previousId: string, id: string, label: string) {
      updater.applyPatch([
        { type: 'remove', blockId: previousId },
        { type: 'insert', html: block(id, label) },
      ])
    }

    replace('first', 'second', 'Second')
    await vi.waitFor(() => expect(finishes).toHaveLength(1))
    replace('second', 'third', 'Third')
    replace('third', 'fourth', 'Fourth')
    expect(root.querySelector('svg')).toBe(previous)
    finishes[0]!()
    await vi.waitFor(() => expect(finishes).toHaveLength(2))
    expect(root.querySelector('svg')).toBe(previous)
    expect(renderedSources).toEqual([
      'graph TD\n  A[First]',
      'graph TD\n  A[Second]',
      'graph TD\n  A[Fourth]',
    ])
    finishes[1]!()
    await vi.waitFor(() =>
      expect(root.querySelector('svg')?.textContent).toBe(
        'graph TD\n  A[Fourth]',
      ),
    )
  })

  test('retains the last valid SVG on invalid edits and clears the error after recovery', async () => {
    const { root, updater } = await createUpdater()
    updater.applyFullHtml(block('valid', 'Valid'))
    await vi.waitFor(() => expect(root.querySelector('svg')).not.toBeNull())
    const previous = root.querySelector('svg')
    const error = { message: 'Syntax error' }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    runMock.mockRejectedValueOnce(error)
    updater.applyPatch([
      { type: 'remove', blockId: 'valid' },
      { type: 'insert', html: block('invalid', 'Incomplete') },
    ])

    await vi.waitFor(() =>
      expect(root.querySelector('[role="status"]')).not.toBeNull(),
    )
    expect(root.querySelector('svg')).toBe(previous)
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'last valid version',
    )
    expect(root.querySelector('[role="status"]')?.getAttribute('title')).toBe(
      'Syntax error',
    )
    expect(log).toHaveBeenCalledWith('Unable to render Mermaid diagram:', error)

    updater.applyPatch([
      { type: 'remove', blockId: 'invalid' },
      { type: 'insert', html: block('recovered', 'Recovered') },
    ])
    expect(root.querySelector('svg')).toBe(previous)
    await vi.waitFor(() =>
      expect(root.querySelector('[role="status"]')).toBeNull(),
    )
    expect(root.querySelector('svg')).not.toBe(previous)
    expect(root.querySelector('svg')).not.toBeNull()
  })

  test('preserves diagrams independently across separate patch gaps', async () => {
    const { root, updater } = await createUpdater()
    updater.applyFullHtml(
      block('a', 'One') +
        '<div data-pvmd-block-id="separator"><p>Unchanged</p></div>' +
        block('b', 'Two'),
    )
    await vi.waitFor(() => expect(root.querySelectorAll('svg')).toHaveLength(2))
    const previous = [...root.querySelectorAll('svg')]
    const separator = root.querySelector('[data-pvmd-block-id="separator"]')
    updater.applyPatch([
      { type: 'remove', blockId: 'a' },
      {
        type: 'insert',
        beforeBlockId: 'separator',
        html: block('aa', 'Updated one'),
      },
      { type: 'remove', blockId: 'b' },
      { type: 'insert', html: block('bb', 'Updated two') },
    ])
    expect([...root.querySelectorAll('svg')]).toEqual(previous)
    expect(root.querySelector('[data-pvmd-block-id="separator"]')).toBe(
      separator,
    )
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(4))
    expect(renderedSources).toEqual([
      'graph TD\n  A[One]',
      'graph TD\n  A[Two]',
      'graph TD\n  A[Updated one]',
      'graph TD\n  A[Updated two]',
    ])
  })

  test('does not resurrect a removed diagram when its render finishes', async () => {
    const { root, updater } = await createUpdater()
    updater.applyFullHtml(block('first', 'First'))
    await vi.waitFor(() => expect(root.querySelector('svg')).not.toBeNull())
    let finish: (() => void) | undefined
    runMock.mockImplementationOnce(
      ({ nodes }) =>
        new Promise<void>((resolve) => {
          finish = () => {
            nodes[0]!.innerHTML = '<svg></svg>'
            resolve()
          }
        }),
    )
    updater.applyPatch([
      { type: 'remove', blockId: 'first' },
      { type: 'insert', html: block('second', 'Second') },
    ])
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(2))
    updater.applyPatch([{ type: 'remove', blockId: 'second' }])
    finish!()
    await vi.waitFor(() =>
      expect(document.querySelector('.mermaid-render-container')).toBeNull(),
    )
    expect(root.querySelector('pre')).toBeNull()
    expect(runMock).toHaveBeenCalledTimes(2)
  })

  test('clears pending state when an edit reverts to the already rendered source', async () => {
    const { root, updater } = await createUpdater()
    updater.applyFullHtml(block('first', 'Original'))
    await vi.waitFor(() => expect(root.querySelector('svg')).not.toBeNull())
    const previous = root.querySelector('svg')
    let finish: (() => void) | undefined
    runMock.mockImplementationOnce(
      ({ nodes }) =>
        new Promise<void>((resolve) => {
          finish = () => {
            nodes[0]!.innerHTML = '<svg><text>Superseded edit</text></svg>'
            resolve()
          }
        }),
    )
    updater.applyPatch([
      { type: 'remove', blockId: 'first' },
      { type: 'insert', html: block('changed', 'Changed') },
    ])
    await vi.waitFor(() => expect(runMock).toHaveBeenCalledTimes(2))
    updater.applyPatch([
      { type: 'remove', blockId: 'changed' },
      { type: 'insert', html: block('first', 'Original') },
    ])
    finish!()
    await vi.waitFor(() => expect(root.querySelector('[aria-busy]')).toBeNull())
    expect(root.querySelector('svg')).toBe(previous)
    expect(runMock).toHaveBeenCalledTimes(2)
  })
})
