import 'katex/dist/katex.min.css'
import './styles.css'
import { type LiveUpdateOperation } from '@/shared/live-update'
import { applyContentEnhancements } from './content-enhancements'
import { connectLiveUpdates } from './live-updates'
import { createMarkdownContentUpdater } from './markdown-content-updater'

const markdownContent = document.getElementById('markdown-content')
const watchEnabled = document.body.dataset['watch'] !== 'false'

let applyFullHtml: (html: string) => void = () => {}
let applyPatch: (ops: LiveUpdateOperation[]) => void = () => {}

if (markdownContent) {
  const updater = createMarkdownContentUpdater(markdownContent, {
    applyEnhancements: applyContentEnhancements,
  })

  applyFullHtml = updater.applyFullHtml
  applyPatch = updater.applyPatch
  applyContentEnhancements(markdownContent)
}

connectLiveUpdates({
  enabled: watchEnabled,
  onFullHtml: applyFullHtml,
  onPatch: applyPatch,
})
