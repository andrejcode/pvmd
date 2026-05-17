import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateOperation,
} from '@/shared/live-update'
import { captureDetailsStates, restoreDetailsStates } from './details-state'

interface MarkdownContentUpdaterOptions {
  applyEnhancements: (root: HTMLElement) => void
}

export function createMarkdownContentUpdater(
  root: HTMLElement,
  { applyEnhancements }: MarkdownContentUpdaterOptions,
) {
  function applyFullHtml(html: string) {
    const detailsStates = captureDetailsStates(root)
    root.innerHTML = html
    applyEnhancements(root)
    restoreDetailsStates(root, detailsStates)
  }

  function applyPatch(ops: LiveUpdateOperation[]) {
    const detailsStates = captureDetailsStates(root)

    // Apply each operation directly against the existing block wrappers so
    // untouched markdown sections stay mounted in the DOM.
    for (const op of ops) {
      if (op.type === 'remove') {
        root
          .querySelector(`[${LIVE_BLOCK_ATTRIBUTE}="${op.blockId}"]`)
          ?.remove()
        continue
      }

      const block = createBlockElement(op.html)
      if (!block) {
        continue
      }

      if (op.beforeBlockId) {
        const referenceBlock = root.querySelector(
          `[${LIVE_BLOCK_ATTRIBUTE}="${op.beforeBlockId}"]`,
        )

        if (referenceBlock) {
          root.insertBefore(block, referenceBlock)
        } else {
          root.appendChild(block)
        }
      } else {
        root.appendChild(block)
      }

      applyEnhancements(block)
    }

    restoreDetailsStates(root, detailsStates)
  }

  return {
    applyFullHtml,
    applyPatch,
  }
}

function createBlockElement(html: string): HTMLElement | null {
  const template = document.createElement('template')
  template.innerHTML = html.trim()

  const firstElement = template.content.firstElementChild
  return firstElement instanceof HTMLElement ? firstElement : null
}
