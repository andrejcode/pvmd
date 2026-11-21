import type { Mermaid, MermaidConfig } from 'mermaid'

let mermaidLoader: Promise<Mermaid> | undefined
let activeTheme: string | undefined
let watchingSystemTheme = false
let rendering = false

interface Diagram {
  node: HTMLElement
  source: string
  revision: number
  hasValidRender: boolean
  attemptedSource?: string
  attemptedTheme?: string
}

const diagrams = new WeakMap<HTMLElement, Diagram>()
const pendingDiagrams = new Set<Diagram>()
const DIAGRAM_SELECTOR = 'pre.mermaid:not([data-pvmd-mermaid-staging])'

function loadMermaid(): Promise<Mermaid> {
  mermaidLoader ??= import('mermaid')
    .then(({ default: mermaid }) => mermaid)
    .catch((error: unknown) => {
      mermaidLoader = undefined
      throw error
    })
  return mermaidLoader
}

function toHex(color: string): string {
  const channels = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (!channels) {
    throw new Error(`Unsupported Markdown theme color: ${color}`)
  }

  return `#${channels
    .slice(1)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function getThemeConfig(): MermaidConfig {
  // Read the actual Markdown palette, including themes whose CSS hardcodes colors.
  const probe = document.createElement('div')
  probe.hidden = true
  const code = document.createElement('pre')
  const link = document.createElement('a')
  link.href = '#'
  const quote = document.createElement('blockquote')
  probe.append(code, link, quote)
  document.body.appendChild(probe)

  try {
    const bodyStyle = getComputedStyle(document.body)
    const background = toHex(bodyStyle.backgroundColor)
    const text = toHex(bodyStyle.color)
    const surface = toHex(getComputedStyle(code).backgroundColor)
    const accent = toHex(getComputedStyle(link).color)
    const muted = toHex(getComputedStyle(quote).color)
    const border = toHex(getComputedStyle(quote).borderLeftColor)

    return {
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      look: 'classic',
      fontFamily: bodyStyle.fontFamily,
      themeVariables: {
        darkMode: bodyStyle.colorScheme === 'dark',
        fontFamily: bodyStyle.fontFamily,
        background,
        primaryColor: surface,
        primaryTextColor: text,
        primaryBorderColor: accent,
        secondaryColor: surface,
        secondaryTextColor: text,
        secondaryBorderColor: border,
        tertiaryColor: background,
        tertiaryTextColor: text,
        tertiaryBorderColor: border,
        lineColor: muted,
        textColor: text,
        mainBkg: surface,
        nodeBorder: accent,
        clusterBkg: surface,
        clusterBorder: border,
        edgeLabelBackground: background,
        actorBkg: surface,
        actorBorder: accent,
        actorTextColor: text,
        actorLineColor: muted,
        signalColor: text,
        signalTextColor: text,
        labelBoxBkgColor: surface,
        labelBoxBorderColor: border,
        labelTextColor: text,
        loopTextColor: text,
        noteBkgColor: surface,
        noteBorderColor: accent,
        noteTextColor: text,
        activationBkgColor: surface,
        activationBorderColor: accent,
        titleColor: text,
      },
    }
  } finally {
    probe.remove()
  }
}

export function preserveMermaidDiagrams(
  previousRoots: readonly HTMLElement[],
  nextRoots: readonly HTMLElement[],
): void {
  const previous = previousRoots
    .flatMap(getDiagramNodes)
    .map((node) => diagrams.get(node))
    .filter((diagram): diagram is Diagram => diagram !== undefined)
  const next = nextRoots.flatMap(getDiagramNodes)
  const matches = new Map<HTMLElement, Diagram>()
  const remaining = new Set(previous)

  // Match unchanged source first so inserting/deleting a diagram does not
  // transfer a neighbouring diagram's preview into the wrong block.
  for (const node of next) {
    const match = previous.find(
      (diagram) =>
        remaining.has(diagram) && diagram.source === node.textContent,
    )
    if (match) {
      matches.set(node, match)
      remaining.delete(match)
    }
  }
  const unmatched = next.filter((node) => !matches.has(node))
  if (unmatched.length === remaining.size) {
    const old = [...remaining]
    unmatched.forEach((node, index) => matches.set(node, old[index]!))
  }

  for (const [node, diagram] of matches) {
    const source = node.textContent ?? ''
    const previousNode = diagram.node
    diagrams.delete(previousNode)
    if (source !== diagram.source) diagram.revision += 1
    diagram.source = source
    diagram.node = node
    node.replaceChildren(...previousNode.childNodes)
    if (previousNode.hasAttribute('aria-busy')) {
      node.setAttribute('aria-busy', previousNode.getAttribute('aria-busy')!)
    }
    diagrams.set(node, diagram)
  }
}

function getDiagramNodes(root: HTMLElement): HTMLElement[] {
  return [
    ...(root.matches(DIAGRAM_SELECTOR) ? [root] : []),
    ...root.querySelectorAll<HTMLElement>(DIAGRAM_SELECTOR),
  ]
}

export function renderMermaidDiagrams(root: HTMLElement): void {
  for (const node of getDiagramNodes(root)) {
    let diagram = diagrams.get(node)
    if (!diagram) {
      if (node.hasAttribute('data-processed')) continue
      diagram = {
        node,
        source: node.textContent ?? '',
        revision: 0,
        hasValidRender: false,
      }
      diagrams.set(node, diagram)
    }
    pendingDiagrams.add(diagram)
  }

  if (pendingDiagrams.size === 0) return

  if (!watchingSystemTheme) {
    window
      .matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', () => renderMermaidDiagrams(document.body))
    watchingSystemTheme = true
  }

  startRendering()
}

function startRendering(): void {
  if (rendering) return
  rendering = true
  // Mermaid configuration is global; keep one render in flight and retain only
  // the latest pending source for each diagram.
  void renderPendingDiagrams()
    .catch((error: unknown) => {
      console.error('Unable to initialize Mermaid diagrams:', error)
      for (const diagram of pendingDiagrams) {
        if (diagram.node.isConnected) showDiagramError(diagram, error)
      }
      pendingDiagrams.clear()
    })
    .finally(() => {
      rendering = false
      if (pendingDiagrams.size > 0) startRendering()
    })
}

async function renderPendingDiagrams(): Promise<void> {
  const mermaid = await loadMermaid()
  while (pendingDiagrams.size > 0) {
    const diagram = pendingDiagrams.values().next().value!
    if (!diagram.node.isConnected) {
      pendingDiagrams.delete(diagram)
      continue
    }

    const config = getThemeConfig()
    const theme = JSON.stringify(config)
    const source = diagram.source
    const revision = diagram.revision
    if (
      diagram.attemptedSource === source &&
      diagram.attemptedTheme === theme
    ) {
      pendingDiagrams.delete(diagram)
      diagram.node.removeAttribute('aria-busy')
      continue
    }
    if (activeTheme !== theme) {
      mermaid.initialize(config)
      activeTheme = theme
    }
    pendingDiagrams.delete(diagram)

    const container = document.createElement('div')
    container.className = 'mermaid-render-container'
    container.setAttribute('aria-hidden', 'true')
    container.style.width = `${diagram.node.getBoundingClientRect().width || document.documentElement.clientWidth}px`
    const staging = document.createElement('pre')
    staging.className = 'mermaid'
    staging.setAttribute('data-pvmd-mermaid-staging', '')
    staging.textContent = source
    container.appendChild(staging)
    document.body.appendChild(container)
    diagram.node.setAttribute('aria-busy', 'true')

    function isCurrent(): boolean {
      return (
        diagram.node.isConnected &&
        diagram.revision === revision &&
        JSON.stringify(getThemeConfig()) === theme
      )
    }

    try {
      await mermaid.run({ nodes: [staging] })
      if (!staging.querySelector('svg')) {
        throw new Error('Mermaid did not produce a diagram')
      }
      if (isCurrent()) {
        diagram.node.replaceChildren(...staging.childNodes)
        diagram.node.setAttribute('data-processed', 'true')
        diagram.hasValidRender = true
        diagram.attemptedSource = source
        diagram.attemptedTheme = theme
        diagram.node.removeAttribute('aria-busy')
      } else if (diagram.node.isConnected) {
        pendingDiagrams.add(diagram)
      }
    } catch (error) {
      if (isCurrent()) {
        diagram.attemptedSource = source
        diagram.attemptedTheme = theme
        showDiagramError(diagram, error)
        console.error('Unable to render Mermaid diagram:', error)
      } else if (diagram.node.isConnected) {
        pendingDiagrams.add(diagram)
      }
    } finally {
      container.remove()
    }
  }
}

function showDiagramError(diagram: Diagram, error: unknown): void {
  const node = diagram.node
  if (!diagram.hasValidRender) node.textContent = diagram.source
  node.querySelector('.mermaid-error')?.remove()
  const message = document.createElement('span')
  message.className = 'mermaid-error'
  message.setAttribute('role', 'status')
  const label = document.createElement('strong')
  label.className = 'mermaid-error-title'
  label.textContent = 'pvmd: Mermaid error'
  const description = document.createElement('span')
  description.className = 'mermaid-error-description'
  description.textContent = diagram.hasValidRender
    ? 'Unable to render diagram. Showing the last valid version.'
    : 'Unable to render diagram.'
  message.append(label, document.createTextNode('\n'), description)
  message.title =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : String(error)
  node.appendChild(message)
  node.removeAttribute('aria-busy')
}
