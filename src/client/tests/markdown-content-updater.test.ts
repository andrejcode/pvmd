import { applyContentEnhancements } from '../content-enhancements'
import { createMarkdownContentUpdater } from '../markdown-content-updater'

describe('markdown content updater', () => {
  function createUpdater() {
    const root = document.getElementById('markdown-content')!
    const updater = createMarkdownContentUpdater(root, {
      applyEnhancements: applyContentEnhancements,
    })

    return { root, updater }
  }

  beforeEach(() => {
    document.body.innerHTML = '<main id="markdown-content"></main>'
  })

  test('updates markdown content with full HTML', () => {
    const { root, updater } = createUpdater()
    const testHtml = '<h1>Test Content</h1>'

    updater.applyFullHtml(testHtml)

    expect(root.innerHTML).toBe(testHtml)
  })

  test('inserts only the patched block content', () => {
    const { root, updater } = createUpdater()

    updater.applyFullHtml(
      '<div data-pvmd-block-id="block-1"><p>Before</p></div>',
    )
    updater.applyPatch([
      {
        type: 'insert',
        html: '<div data-pvmd-block-id="block-2"><p>After</p></div>',
      },
    ])

    const blocks = root.querySelectorAll('[data-pvmd-block-id]')
    expect(blocks).toHaveLength(2)
    expect(root.textContent).toContain('Before')
    expect(root.textContent).toContain('After')
  })

  test('inserts a patched block before the reference block', () => {
    const { root, updater } = createUpdater()

    updater.applyFullHtml(
      '<div data-pvmd-block-id="block-1"><p>First</p></div><div data-pvmd-block-id="block-3"><p>Third</p></div>',
    )
    updater.applyPatch([
      {
        type: 'insert',
        beforeBlockId: 'block-3',
        html: '<div data-pvmd-block-id="block-2"><p>Second</p></div>',
      },
    ])

    expect(root.textContent).toBe('FirstSecondThird')
  })

  test('preserves expanded details state across full content updates', () => {
    const { updater } = createUpdater()

    updater.applyFullHtml(
      '<div data-pvmd-block-id="block-1"><details><summary>Old title</summary><p>Before</p></details></div>',
    )
    document.querySelector<HTMLDetailsElement>('details')!.open = true

    updater.applyFullHtml(
      '<div data-pvmd-block-id="block-2"><details><summary>New title</summary><p>After</p></details></div>',
    )

    const details = document.querySelector<HTMLDetailsElement>('details')
    expect(details?.open).toBe(true)
    expect(details?.textContent).toContain('After')
  })

  test('preserves expanded details state across patch replacements', () => {
    const { updater } = createUpdater()

    updater.applyFullHtml(
      '<div data-pvmd-block-id="block-1"><details><summary>Title</summary><p>Before</p></details></div>',
    )
    document.querySelector<HTMLDetailsElement>('details')!.open = true

    updater.applyPatch([
      { type: 'remove', blockId: 'block-1' },
      {
        type: 'insert',
        html: '<div data-pvmd-block-id="block-2"><details><summary>Title</summary><p>After</p></details></div>',
      },
    ])

    const details = document.querySelector<HTMLDetailsElement>('details')
    expect(details?.open).toBe(true)
    expect(details?.textContent).toContain('After')
  })

  test('preserves collapsed details state across updates', () => {
    const { updater } = createUpdater()

    updater.applyFullHtml(
      '<div data-pvmd-block-id="block-1"><details open><summary>Title</summary><p>Before</p></details></div>',
    )
    document.querySelector<HTMLDetailsElement>('details')!.open = false

    updater.applyPatch([
      { type: 'remove', blockId: 'block-1' },
      {
        type: 'insert',
        html: '<div data-pvmd-block-id="block-2"><details open><summary>Title</summary><p>After</p></details></div>',
      },
    ])

    const details = document.querySelector<HTMLDetailsElement>('details')
    expect(details?.open).toBe(false)
    expect(details?.textContent).toContain('After')
  })

  test('replaces old copy buttons when full content updates', () => {
    const { updater } = createUpdater()

    updater.applyFullHtml('<pre><code>first</code></pre>')
    expect(document.querySelectorAll('.copy-button')).toHaveLength(1)

    updater.applyFullHtml(
      '<pre><code>second</code></pre><pre><code>third</code></pre>',
    )
    expect(document.querySelectorAll('.copy-button')).toHaveLength(2)
  })
})
