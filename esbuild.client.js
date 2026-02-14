import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const result = await build({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  minify: true,
  outdir: 'dist/client',
  loader: {
    '.css': 'css',
  },
})

// Assumes single entry point produces exactly one .js and one .css file
const js =
  result.outputFiles.find((file) => file.path.endsWith('.js'))?.text || ''
const css =
  result.outputFiles.find((file) => file.path.endsWith('.css'))?.text || ''

const html = await readFile('src/client/index.html', 'utf-8')
const lightFavicon = await readFile(
  'src/client/favicon/light-favicon.svg',
  'utf-8',
)
const darkFavicon = await readFile(
  'src/client/favicon/dark-favicon.svg',
  'utf-8',
)

let output = html
output = output.replace('<!-- STYLE_OUTLET -->', `<style>${css}</style>`)
output = output.replace(
  '<!-- SCRIPT_OUTLET -->',
  `<script data-pvmd-app>${js}</script>`,
)
output = output.replace(
  /href="favicon\/light-favicon\.svg"/,
  `href="data:image/svg+xml,${encodeURIComponent(lightFavicon)}"`,
)
output = output.replace(
  /href="favicon\/dark-favicon\.svg"/,
  `href="data:image/svg+xml,${encodeURIComponent(darkFavicon)}"`,
)

await mkdir('dist/client', { recursive: true })
await writeFile('dist/client/index.html', output)
