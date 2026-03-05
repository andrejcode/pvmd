import { build } from 'esbuild'
import { assembleHTML } from './esbuild.client.common.js'

const result = await build({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  minify: true,
  outdir: 'dist/client',
  alias: {
    '@': './src',
  },
  loader: {
    '.css': 'css',
  },
})

await assembleHTML(result, 'dist/client')
