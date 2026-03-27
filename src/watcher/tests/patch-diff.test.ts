import { renderMarkdownDocument } from '../../markdown'
import { createLiveUpdateMessage } from '../patch-diff'

describe('createLiveUpdateMessage', () => {
  test('emits a patch when only rendered footnotes change', () => {
    const previous = renderMarkdownDocument(
      'Paragraph with note[^1].\n\n[^1]: First',
    )
    const next = renderMarkdownDocument(
      'Paragraph with note[^1].\n\n[^1]: Second',
    )

    const message = createLiveUpdateMessage(previous, next)

    expect(message).not.toBeNull()
    expect(message?.kind).toBe('patch')

    if (!message || message.kind !== 'patch') {
      throw new Error('Expected patch message')
    }

    const insertedFootnotesBlock = message.ops.find(
      (op): op is Extract<(typeof message.ops)[number], { type: 'insert' }> =>
        op.type === 'insert' && op.html.includes('<section class="footnotes"'),
    )

    expect(insertedFootnotesBlock).toBeDefined()
    expect(insertedFootnotesBlock?.html).toContain('Second')
  })
})
