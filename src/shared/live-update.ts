export const LIVE_BLOCK_ATTRIBUTE = 'data-pvmd-block-id'

export interface LiveUpdateBlock {
  id: string
  html: string
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
  | {
      kind: 'full'
      html: string
    }
  | {
      kind: 'patch'
      ops: LiveUpdateOperation[]
    }
