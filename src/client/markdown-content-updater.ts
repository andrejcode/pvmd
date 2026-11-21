import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateOperation,
} from '@/shared/live-update'
import { captureDetailsStates, restoreDetailsStates } from './details-state'
import { preserveMermaidDiagrams } from './mermaid-diagrams'

interface MarkdownContentUpdaterOptions {
  applyEnhancements: (root: HTMLElement) => void
}

export function createMarkdownContentUpdater(
  root: HTMLElement,
  { applyEnhancements }: MarkdownContentUpdaterOptions,
) {
  function applyFullHtml(html: string) {
    const detailsStates = captureDetailsStates(root)
    const next = document.createElement('div')
    next.innerHTML = html
    preserveMermaidDiagrams([root], [next])
    root.replaceChildren(...next.childNodes)
    applyEnhancements(root)
    restoreDetailsStates(root, detailsStates)
  }

  function applyPatch(ops: LiveUpdateOperation[]) {
    const detailsStates = captureDetailsStates(root)
    const insertedBlocks = ops.map((op) =>
      op.type === 'insert' ? createBlockElement(op.html) : null,
    )
    preservePatchedDiagrams(root, ops, insertedBlocks)

    // Apply each operation directly against the existing block wrappers so
    // untouched markdown sections stay mounted in the DOM.
    for (const [index, op] of ops.entries()) {
      if (op.type === 'remove') {
        root
          .querySelector(`[${LIVE_BLOCK_ATTRIBUTE}="${op.blockId}"]`)
          ?.remove()
        continue
      }

      const block = insertedBlocks[index]
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

function preservePatchedDiagrams(
  root: HTMLElement,
  ops: readonly LiveUpdateOperation[],
  insertedBlocks: readonly (HTMLElement | null)[],
): void {
  const removedIds = new Set(
    ops.flatMap((op) => (op.type === 'remove' ? [op.blockId] : [])),
  )
  const previousGroups = new Map<string, HTMLElement[]>()
  const nextGroups = new Map<string, HTMLElement[]>()
  for (const child of root.children) {
    if (!(child instanceof HTMLElement)) continue
    if (!removedIds.has(child.getAttribute(LIVE_BLOCK_ATTRIBUTE) ?? ''))
      continue
    let reference = child.nextElementSibling
    while (
      reference &&
      removedIds.has(reference.getAttribute(LIVE_BLOCK_ATTRIBUTE) ?? '')
    ) {
      reference = reference.nextElementSibling
    }
    const anchor = reference?.getAttribute(LIVE_BLOCK_ATTRIBUTE) ?? ''
    const group = previousGroups.get(anchor) ?? []
    group.push(child)
    previousGroups.set(anchor, group)
  }
  for (const [index, op] of ops.entries()) {
    const block = insertedBlocks[index]
    if (op.type !== 'insert' || !block) continue
    const anchor = op.beforeBlockId ?? ''
    const group = nextGroups.get(anchor) ?? []
    group.push(block)
    nextGroups.set(anchor, group)
  }
  for (const [anchor, previous] of previousGroups) {
    preserveMermaidDiagrams(previous, nextGroups.get(anchor) ?? [])
  }
}

function createBlockElement(html: string): HTMLElement | null {
  const template = document.createElement('template')
  template.innerHTML = html.trim()

  const firstElement = template.content.firstElementChild
  return firstElement instanceof HTMLElement ? firstElement : null
}
