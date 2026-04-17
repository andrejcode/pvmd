import { renderBlocksHtml } from '@/markdown'
import {
  LIVE_BLOCK_ATTRIBUTE,
  type LiveUpdateBlock,
  type LiveUpdateMessage,
  type LiveUpdateOperation,
} from '@/shared/live-update'

export function createLiveUpdateMessage(
  previousBlocks: LiveUpdateBlock[] | null,
  nextBlocks: LiveUpdateBlock[],
): LiveUpdateMessage | null {
  if (!previousBlocks) {
    return {
      kind: 'full',
      html: renderBlocksHtml(nextBlocks),
    }
  }

  const ops = diffBlocks(previousBlocks, nextBlocks)
  if (ops.length === 0) {
    return null
  }

  return {
    kind: 'patch',
    ops,
  }
}

// Diff the old and new block sequences around their shared backbone so we only
// emit insert/remove operations for the gaps between unchanged blocks.
function diffBlocks(
  previousBlocks: LiveUpdateBlock[],
  nextBlocks: LiveUpdateBlock[],
): LiveUpdateOperation[] {
  const previousIds = previousBlocks.map((block) => block.id)
  const nextIds = nextBlocks.map((block) => block.id)
  const matches = findLongestCommonSubsequence(previousIds, nextIds)
  const ops: LiveUpdateOperation[] = []

  let previousIndex = 0
  let nextIndex = 0

  for (const [matchedPreviousIndex, matchedNextIndex] of [
    ...matches,
    [previousIds.length, nextIds.length] as const,
  ]) {
    while (previousIndex < matchedPreviousIndex) {
      ops.push({
        type: 'remove',
        blockId: previousIds[previousIndex]!,
      })
      previousIndex += 1
    }

    while (nextIndex < matchedNextIndex) {
      const beforeBlockId = nextIds[matchedNextIndex]

      ops.push({
        type: 'insert',
        html: wrapBlockForInsertion(nextBlocks[nextIndex]!),
        ...(beforeBlockId ? { beforeBlockId } : {}),
      })
      nextIndex += 1
    }

    previousIndex += 1
    nextIndex += 1
  }

  return ops
}

// Build the standard dynamic-programming matrix for longest common subsequence
// so later blocks can stay mounted even when content is inserted or removed
// earlier in the document.
function findLongestCommonSubsequence(
  previousIds: string[],
  nextIds: string[],
): Array<readonly [number, number]> {
  const matrix = Array.from({ length: previousIds.length + 1 }, () =>
    Array<number>(nextIds.length + 1).fill(0),
  )

  for (
    let previousIndex = previousIds.length - 1;
    previousIndex >= 0;
    previousIndex -= 1
  ) {
    for (let nextIndex = nextIds.length - 1; nextIndex >= 0; nextIndex -= 1) {
      if (previousIds[previousIndex] === nextIds[nextIndex]) {
        matrix[previousIndex]![nextIndex] =
          matrix[previousIndex + 1]![nextIndex + 1]! + 1
      } else {
        matrix[previousIndex]![nextIndex] = Math.max(
          matrix[previousIndex + 1]![nextIndex]!,
          matrix[previousIndex]![nextIndex + 1]!,
        )
      }
    }
  }

  const matches: Array<readonly [number, number]> = []
  let previousIndex = 0
  let nextIndex = 0

  while (previousIndex < previousIds.length && nextIndex < nextIds.length) {
    if (previousIds[previousIndex] === nextIds[nextIndex]) {
      matches.push([previousIndex, nextIndex])
      previousIndex += 1
      nextIndex += 1
      continue
    }

    if (
      matrix[previousIndex + 1]![nextIndex]! >=
      matrix[previousIndex]![nextIndex + 1]!
    ) {
      previousIndex += 1
    } else {
      nextIndex += 1
    }
  }

  return matches
}

function wrapBlockForInsertion(block: LiveUpdateBlock): string {
  return `<div ${LIVE_BLOCK_ATTRIBUTE}="${block.id}">${block.html}</div>`
}
