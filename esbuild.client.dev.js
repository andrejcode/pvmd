import { context } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { watch } from 'node:fs'

let isRebuilding = false

async function buildHTML(result) {
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

  await mkdir('.dev-build/client', { recursive: true })
  await writeFile('.dev-build/client/index.html', output)
  console.log('Client rebuilt')
}

const ctx = await context({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  minify: false,
  sourcemap: 'inline',
  outdir: '.dev-build/client',
  loader: {
    '.css': 'css',
  },
  plugins: [
    {
      name: 'rebuild-html',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            await buildHTML(result)
          }
        })
      },
    },
  ],
})

console.log('Building client...')

await ctx.watch()
console.log('Watching for changes...')

watch('src/client/index.html', async () => {
  if (isRebuilding) return
  isRebuilding = true

  console.log('index.html changed, rebuilding...')
  try {
    const result = await ctx.rebuild()
    if (result.errors.length === 0) {
      await buildHTML(result)
    }
  } finally {
    isRebuilding = false
  }
})

process.on('SIGINT', async () => {
  await ctx.dispose()
  process.exit(0)
})
