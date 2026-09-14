/**
 * Bundles the production build into one self-contained HTML file.
 *
 * Used for publishing the game somewhere that serves a single page — no asset
 * requests, no base path to get wrong. `npm run single`.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const assets = readdirSync(join(dist, 'assets'))
const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))

const style = css ? readFileSync(join(dist, 'assets', css), 'utf8') : ''
// A closing tag inside the bundle would end the inline script early.
const script = readFileSync(join(dist, 'assets', js), 'utf8').replaceAll('</script', '<\\/script')

const html = `<title>INFILL</title>
<style>
${style}
</style>
<div id="root"></div>
<script type="module">
${script}
</script>
`

writeFileSync(join(dist, 'infill.html'), html)
console.log(`dist/infill.html — ${(html.length / 1024).toFixed(0)} kB`)
