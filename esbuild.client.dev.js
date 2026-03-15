import { context } from 'esbuild'
import { watch } from 'node:fs'
import { assembleHTML } from './esbuild.client.common.js'

const outdir = '.dev-build/client'
let isRebuilding = false

const ctx = await context({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  minify: false,
  sourcemap: 'inline',
  outdir,
  alias: {
    '@': './src',
  },
  loader: {
    '.css': 'css',
    '.woff2': 'dataurl',
    '.woff': 'dataurl',
    '.ttf': 'dataurl',
  },
  plugins: [
    {
      name: 'rebuild-html',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            await assembleHTML(result, outdir)
            console.log('Client rebuilt')
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
      await assembleHTML(result, outdir)
      console.log('Client rebuilt')
    }
  } finally {
    isRebuilding = false
  }
})

process.on('SIGINT', async () => {
  await ctx.dispose()
  process.exit(0)
})
