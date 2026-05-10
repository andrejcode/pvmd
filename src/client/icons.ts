import { Copy, X, createIcons } from 'lucide'

function createIcon(name: string): HTMLElement {
  const icon = document.createElement('i')
  icon.setAttribute('data-lucide', name)
  return icon
}

export function createCopyIcon(): HTMLElement {
  return createIcon('copy')
}

export function renderIcons(root: Element | Document = document): void {
  createIcons({
    icons: {
      Copy,
      X,
    },
    root,
  })
}
