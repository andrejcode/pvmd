import type { Mermaid } from 'mermaid'

let mermaidLoader: Promise<Mermaid> | undefined

function loadMermaid(): Promise<Mermaid> {
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: prefersDarkTheme() ? 'dark' : 'default',
    })

    return mermaid
  })

  return mermaidLoader
}

function prefersDarkTheme(): boolean {
  const colorScheme = getComputedStyle(document.body).colorScheme

  if (colorScheme === 'dark') {
    return true
  }

  if (colorScheme === 'light') {
    return false
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function renderMermaidDiagrams(root: HTMLElement): void {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])'),
  )

  if (nodes.length === 0) {
    return
  }

  void loadMermaid()
    .then((mermaid) => mermaid.run({ nodes, suppressErrors: true }))
    .catch(() => {
      // Keep the diagram source visible when rendering fails.
    })
}
