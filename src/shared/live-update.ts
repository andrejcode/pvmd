export const LIVE_BLOCK_ATTRIBUTE = 'data-pvmd-block-id'

export interface LiveUpdateBlock {
  id: string
  html: string
  sourceStartLine?: number
  sourceEndLine?: number
}

export interface ScrollUpdateMessage {
  kind: 'scroll'
  blockId: string
  progress: number
}

export type LiveUpdateOperation =
  | {
      type: 'insert'
      html: string
      beforeBlockId?: string
    }
  | {
      type: 'remove'
      blockId: string
    }

export type LiveUpdateMessage =
  | ScrollUpdateMessage
  | {
      kind: 'full'
      html: string
    }
  | {
      kind: 'patch'
      ops: LiveUpdateOperation[]
    }
