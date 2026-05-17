import { createCopyIcon, renderIcons } from './icons'

function addCopyButtons(root: Element) {
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre code'))
  for (const code of codeBlocks) {
    const pre = code.parentElement
    if (!pre) continue

    const button = document.createElement('button')
    button.className = 'copy-button'
    button.ariaLabel = 'Copy code'
    button.appendChild(createCopyIcon())
    renderIcons(button)

    button.addEventListener('click', () => {
      const text = code.textContent ?? ''
      void navigator.clipboard.writeText(text).then(() => {
        button.classList.add('copied')
        setTimeout(() => {
          button.classList.remove('copied')
        }, 2000)
      })
    })

    pre.appendChild(button)
  }
}

function disableInteractiveContent(root: HTMLElement) {
  const controls = root.querySelectorAll<HTMLElement>(
    'button, input, select, textarea',
  )

  for (const control of controls) {
    if (control.classList.contains('copy-button')) {
      continue
    }

    if (
      control instanceof HTMLButtonElement ||
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
    ) {
      control.disabled = true
    }

    control.setAttribute('aria-disabled', 'true')
    control.setAttribute('tabindex', '-1')
  }
}

function openExternalLinksInNewTab(root: HTMLElement) {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href]')
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('http://') || href.startsWith('https://')) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

export function applyContentEnhancements(root: HTMLElement) {
  addCopyButtons(root)
  disableInteractiveContent(root)
  openExternalLinksInNewTab(root)
}
