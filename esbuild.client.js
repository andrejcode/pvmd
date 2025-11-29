import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const result = await build({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  minify: true,
})

const js = result.outputFiles[0].text
const html = await readFile('src/client/index.html', 'utf-8')
const output = html.replace('<!-- SCRIPT_OUTLET -->', `<script>${js}</script>`)

await mkdir('dist/client', { recursive: true })
await writeFile('dist/client/index.html', output)
