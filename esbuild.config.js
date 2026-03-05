import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
const packageJson = require(resolve(__dirname, 'package.json'))

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  external: ['node:*'],
  minify: true,
  alias: {
    '@': './src',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.PVMD_VERSION': `"${packageJson.version}"`,
  },
})
