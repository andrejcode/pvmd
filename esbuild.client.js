import { build } from 'esbuild'
import { assembleHTML, clientBuildOptions } from './esbuild.client.common.js'

const result = await build({
  outdir: 'dist/client',
  minify: true,
  ...clientBuildOptions,
})

await assembleHTML(result, 'dist/client')
