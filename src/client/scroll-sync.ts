import {
  LIVE_BLOCK_ATTRIBUTE,
  type ScrollUpdateMessage,
} from '@/shared/live-update'

export function createScrollSync(root: HTMLElement) {
  let target: ScrollUpdateMessage | undefined
  let observing = false

  function align() {
    if (!target) return
    const block = Array.from(root.children).find(
      (child) => child.getAttribute(LIVE_BLOCK_ATTRIBUTE) === target!.blockId,
    )
    if (!block) return
    const rect = block.getBoundingClientRect()
    const style = getComputedStyle(root)
    const leadingPadding =
      block === root.firstElementChild && target.progress === 0
        ? parseFloat(style.paddingTop || '0')
        : 0
    const trailingPadding =
      block === root.lastElementChild && target.progress === 1
        ? parseFloat(style.paddingBottom || '0')
        : 0
    window.scrollTo({
      top: Math.max(
        0,
        window.scrollY +
          rect.top +
          rect.height * target.progress -
          leadingPadding +
          trailingPadding,
      ),
      behavior: 'instant',
    })
  }

  return (message: ScrollUpdateMessage) => {
    if (!observing) {
      // Images and async Mermaid rendering can change layout after an update.
      const observer = new ResizeObserver(() => align())
      observer.observe(root)
      root.addEventListener('load', align, true)
      observing = true
    }
    target = message
    align()
  }
}
