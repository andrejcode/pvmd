import { createScrollSync } from '../scroll-sync'

describe('scroll synchronization', () => {
  let resize: ResizeObserverCallback
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML =
      '<main><div data-pvmd-block-id="first">First</div><div data-pvmd-block-id="second">Second</div></main>'
    root = document.querySelector('main')!
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback
        }
        observe() {}
      },
    )
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(100)
    vi.spyOn(root.children[1]!, 'getBoundingClientRect').mockReturnValue({
      top: 300,
      height: 200,
    } as DOMRect)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('aligns the corresponding block without smooth-scroll lag', () => {
    const scroll = createScrollSync(root)
    scroll({ kind: 'scroll', blockId: 'second', progress: 0.5 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 500,
      behavior: 'instant',
    })
    scroll({ kind: 'scroll', blockId: 'second', progress: 0 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 400,
      behavior: 'instant',
    })
  })

  test('preserves top padding on initial alignment and after layout changes', () => {
    root.style.paddingTop = '45px'
    vi.spyOn(root.children[0]!, 'getBoundingClientRect').mockReturnValue({
      top: -55,
      height: 200,
    } as DOMRect)
    const scroll = createScrollSync(root)
    scroll({ kind: 'scroll', blockId: 'first', progress: 0 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: 'instant',
    })
    resize([], {} as ResizeObserver)
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: 'instant',
    })
    scroll({ kind: 'scroll', blockId: 'first', progress: 0.5 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 145,
      behavior: 'instant',
    })
  })

  test('includes bottom padding at the end without offsetting other targets', () => {
    root.style.padding = '30px 0 60px'
    const scroll = createScrollSync(root)
    scroll({ kind: 'scroll', blockId: 'second', progress: 1 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 660,
      behavior: 'instant',
    })
    scroll({ kind: 'scroll', blockId: 'second', progress: 0 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 400,
      behavior: 'instant',
    })
  })

  test('realigns after delayed layout and clamps scrolling above the document', () => {
    const scroll = createScrollSync(root)
    scroll({ kind: 'scroll', blockId: 'second', progress: 0 })
    vi.spyOn(root.children[1]!, 'getBoundingClientRect').mockReturnValue({
      top: -200,
      height: 400,
    } as DOMRect)
    resize([], {} as ResizeObserver)
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: 'instant',
    })
    vi.mocked(window.scrollTo).mockClear()
    root.dispatchEvent(new Event('load'))
    expect(window.scrollTo).toHaveBeenCalledOnce()
  })
})
