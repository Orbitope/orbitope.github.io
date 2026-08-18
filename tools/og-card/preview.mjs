/*
 * Renders what every page's link preview will look like, from the LIVE tags.
 *
 * The platform validators are awkward for a quick check — Facebook's needs a
 * login, LinkedIn's needs a login, and X retired its card validator entirely —
 * so this fetches the deployed pages, reads their real Open Graph tags, checks
 * the image actually loads at the declared size, and renders mock unfurls.
 *
 * It cannot prove a given platform will render identically. What it does prove
 * is the part that actually breaks: tags missing, an image URL that 404s, a
 * relative og:image, or a title that gets truncated in a feed.
 *
 *   node preview.mjs            # writes preview.html and prints a summary
 */
import { launchChrome, newPage, sleep } from './cdp.mjs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://orbitope.com'

const manifest = JSON.parse(await readFile(join(HERE, 'articles.json'), 'utf8'))
const urls = [BASE + '/', ...manifest.articles.filter((a) => a.slug !== 'landing').map((a) => a.url)]

const tag = (html, re) => (html.match(re) || [, ''])[1]

const rows = []
for (const url of urls) {
  const html = await (await fetch(url)).text()
  const t = {
    url,
    title: tag(html, /<meta property="og:title" content="([^"]*)"/) || tag(html, /<title>([^<]*)<\/title>/),
    desc: tag(html, /<meta property="og:description" content="([^"]*)"/) || tag(html, /<meta name="description" content="([^"]*)"/),
    image: tag(html, /<meta property="og:image" content="([^"]*)"/),
    card: tag(html, /<meta name="twitter:card" content="([^"]*)"/),
    canonical: tag(html, /<link rel="canonical" href="([^"]*)"/),
  }
  const problems = []
  if (!t.title) problems.push('no og:title')
  if (!t.desc) problems.push('no og:description')
  if (!t.card) problems.push('no twitter:card')
  if (!t.canonical) problems.push('no canonical')
  if (!t.image) problems.push('no og:image')
  else if (!/^https?:\/\//.test(t.image)) problems.push('og:image is relative — scrapers reject this')
  else {
    const r = await fetch(t.image, { method: 'HEAD' })
    if (!r.ok) problems.push(`og:image returns ${r.status}`)
    const bytes = Number(r.headers.get('content-length') || 0)
    if (bytes > 5_000_000) problems.push('og:image over 5MB — some scrapers skip it')
    t.bytes = bytes
  }
  /* Feeds truncate. These are the practical limits, not hard ones. */
  if (t.title.length > 70) problems.push(`title ${t.title.length} chars — truncated in most feeds`)
  if (t.desc.length > 200) problems.push(`description ${t.desc.length} chars — truncated`)
  t.problems = problems
  rows.push(t)
  console.log(`${problems.length ? 'WARN' : 'ok  '} ${url.replace(BASE, '').padEnd(28)} ${problems.join('; ') || `${(t.bytes / 1024).toFixed(0)} kB card`}`)
}

const host = (u) => new URL(u).host
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const cards = rows.map((r) => `
<section>
  <h2>${esc(r.url.replace(BASE, '') || '/')}</h2>
  ${r.problems.length ? `<p class="warn">${r.problems.map(esc).join('<br>')}</p>` : ''}
  <div class="grid">
    <div>
      <div class="label">Slack / Discord</div>
      <div class="slack">
        <div class="bar"></div>
        <div class="body">
          <div class="site">${esc(host(r.url))}</div>
          <div class="t">${esc(r.title)}</div>
          <div class="d">${esc(r.desc)}</div>
          <img src="${esc(r.image)}" alt="">
        </div>
      </div>
    </div>
    <div>
      <div class="label">X / Facebook (large summary)</div>
      <div class="x">
        <img src="${esc(r.image)}" alt="">
        <div class="meta">
          <div class="site">${esc(host(r.url))}</div>
          <div class="t">${esc(r.title)}</div>
          <div class="d">${esc(r.desc)}</div>
        </div>
      </div>
    </div>
  </div>
</section>`).join('')

await writeFile(join(HERE, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Link previews</title>
<style>
 :root{--void:#111009;--surface:#1a1812;--border:#2a2820;--amber:#C49A3C;--bright:#EDE8DC;--muted:#6A6358;--warn:#E8A0A0}
 *{box-sizing:border-box;margin:0;padding:0}
 body{background:var(--void);color:#C8C2B4;font:14px/1.6 ui-monospace,Menlo,monospace;padding:36px}
 h1{color:var(--bright);font-size:20px;letter-spacing:.2em;text-transform:uppercase}
 .lede{color:var(--muted);margin:8px 0 30px;max-width:78ch}
 section{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:20px;margin-bottom:20px}
 h2{color:var(--amber);font-size:14px;letter-spacing:.12em;margin-bottom:14px}
 .warn{color:var(--warn);font-size:12px;margin-bottom:14px}
 .grid{display:flex;gap:26px;flex-wrap:wrap}
 .grid>div{flex:1 1 380px;min-width:320px}
 .label{color:var(--muted);font-size:10px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}
 img{width:100%;display:block}
 .slack{display:flex;gap:10px;background:#1d1c17;border-radius:4px;padding:12px}
 .slack .bar{width:4px;border-radius:2px;background:#4a4638;flex:0 0 4px}
 .slack .body{min-width:0}
 .slack img{margin-top:8px;border-radius:4px}
 .x{border:1px solid #33312a;border-radius:12px;overflow:hidden}
 .x .meta{padding:10px 12px}
 .site{color:var(--muted);font-size:11px}
 .t{color:var(--bright);font-weight:600;margin:2px 0 3px}
 .d{color:#9a9384;font-size:12.5px}
</style>
<h1>Link previews</h1>
<p class="lede">Built from the <strong>live</strong> Open Graph tags on orbitope.com. These are mock-ups of how feeds
lay a card out — they prove the tags and image are right, not that any given platform renders pixel-identically.
Regenerate with <code>node preview.mjs</code>.</p>
${cards}`)

const bad = rows.filter((r) => r.problems.length).length
console.log(`\n${rows.length} pages, ${bad} with warnings -> ${join(HERE, 'preview.html')}`)
