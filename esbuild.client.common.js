import { readFile, writeFile, mkdir } from 'node:fs/promises'

export async function assembleHTML(result, outdir) {
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
  const closeIcon = await readFile('src/client/icons/close.svg', 'utf-8')
  const copyIcon = await readFile('src/client/icons/copy.svg', 'utf-8')

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
  output = output.replace(
    '<!-- CLOSE_ICON_OUTLET -->',
    `<img src="data:image/svg+xml,${encodeURIComponent(closeIcon)}" alt="Close" />`,
  )
  output = output.replace('<!-- COPY_ICON_OUTLET -->', copyIcon)

  await mkdir(outdir, { recursive: true })
  await writeFile(`${outdir}/index.html`, output)
}
