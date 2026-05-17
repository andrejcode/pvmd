interface DetailsState {
  index: number
  open: boolean
  summaryKey: string
  summaryOccurrence: number
}

export function captureDetailsStates(root: HTMLElement): DetailsState[] {
  const summaryOccurrences = new Map<string, number>()
  return Array.from(root.querySelectorAll<HTMLDetailsElement>('details')).map(
    (details, index) => {
      const summaryKey = getDetailsSummaryKey(details)
      const summaryOccurrence = (summaryOccurrences.get(summaryKey) ?? 0) + 1
      summaryOccurrences.set(summaryKey, summaryOccurrence)

      return {
        index,
        open: details.open,
        summaryKey,
        summaryOccurrence,
      }
    },
  )
}

export function restoreDetailsStates(
  root: HTMLElement,
  previousStates: DetailsState[],
) {
  if (previousStates.length === 0) {
    return
  }

  const previousBySummary = new Map<string, DetailsState>()
  for (const state of previousStates) {
    previousBySummary.set(getDetailsStateKey(state), state)
  }

  const summaryOccurrences = new Map<string, number>()
  const detailsElements = Array.from(
    root.querySelectorAll<HTMLDetailsElement>('details'),
  )

  for (const [index, details] of detailsElements.entries()) {
    const summaryKey = getDetailsSummaryKey(details)
    const summaryOccurrence = (summaryOccurrences.get(summaryKey) ?? 0) + 1
    summaryOccurrences.set(summaryKey, summaryOccurrence)

    const matchingState =
      previousBySummary.get(
        getDetailsStateKey({ summaryKey, summaryOccurrence }),
      ) ?? previousStates[index]

    if (matchingState) {
      details.open = matchingState.open
    }
  }
}

function getDetailsSummaryKey(details: HTMLDetailsElement): string {
  const summary = Array.from(details.children).find(
    (child) => child.tagName.toLowerCase() === 'summary',
  )

  return normalizeDetailsSummary(summary?.textContent ?? '')
}

function normalizeDetailsSummary(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function getDetailsStateKey(
  state: Pick<DetailsState, 'summaryKey' | 'summaryOccurrence'>,
): string {
  return `${state.summaryKey}\x00${state.summaryOccurrence}`
}
