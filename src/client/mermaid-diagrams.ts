import type { Mermaid, MermaidConfig } from 'mermaid'

let mermaidLoader: Promise<Mermaid> | undefined
let renderQueue = Promise.resolve()
let activeTheme: string | undefined
let watchingSystemTheme = false
const diagrams = new WeakMap<HTMLElement, { source: string; theme?: string }>()

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

export function renderMermaidDiagrams(root: HTMLElement): void {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('pre.mermaid'),
  ).filter((node) => {
    if (diagrams.has(node)) return true
    if (node.hasAttribute('data-processed')) return false
    diagrams.set(node, { source: node.textContent ?? '' })
    return true
  })

  if (nodes.length === 0) return

  if (!watchingSystemTheme) {
    window
      .matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', () => renderMermaidDiagrams(document.body))
    watchingSystemTheme = true
  }

  // Mermaid configuration is global: serialize rendering and theme changes.
  renderQueue = renderQueue
    .then(async () => {
      const mermaid = await loadMermaid()
      const connectedNodes = nodes.filter((node) => node.isConnected)
      if (connectedNodes.length === 0) return

      const config = getThemeConfig()
      const theme = JSON.stringify(config)
      if (activeTheme !== theme) {
        mermaid.initialize(config)
        activeTheme = theme
      }

      for (const node of connectedNodes) {
        const diagram = diagrams.get(node)!
        if (!node.isConnected || diagram.theme === theme) continue

        diagram.theme = theme
        node.textContent = diagram.source
        node.removeAttribute('data-processed')
        try {
          await mermaid.run({ nodes: [node] })
        } catch (error) {
          node.textContent = diagram.source
          console.error('Unable to render Mermaid diagram:', error)
        }
      }
    })
    .catch((error: unknown) => {
      console.error('Unable to initialize Mermaid diagrams:', error)
    })
}
