/**
 * Generates the 1200x630 social card for every article in articles.json.
 *
 * Two passes per article, both in headless Chrome:
 *   1. Load the live article, settle it, and clip-capture one figure.
 *   2. Render card.html with that capture as its background layer and the
 *      headline over it, then capture the card.
 *
 * The figures are drawn at runtime (canvas/SVG built by the page's own JS), so
 * there is no source image to copy — capturing the live page IS the way to get
 * the real artefact rather than a mockup of it.
 *
 * Usage:  node generate.mjs [slug ...]     (no args = all)
 */
import { launchChrome, newPage, sleep } from './cdp.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const shotsDir = join(here, 'shots')

/** Freeze reveal animations and force final state, so nothing is captured mid-fade. */
const SETTLE = `
  (() => {
    const s = document.createElement('style')
    s.textContent = '*,*::before,*::after{animation:none !important;transition:none !important;}'
    document.head.appendChild(s)
    // These pages gate figures behind a scroll-reveal class; the class names
    // differ per article, so add the common ones rather than guessing one.
    document.querySelectorAll('[class]').forEach((el) => el.classList.add('in', 'visible', 'revealed', 'shown', 'seen'))
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el)
      if (cs.opacity === '0') el.style.setProperty('opacity', '1', 'important')
    })
    return 'settled'
  })()
`

async function captureFigure(chrome, { url, selector, slug }) {
  const page = await newPage(chrome.port, { width: 1400, height: 1000, scale: 2 })
  try {
    await page.goto(url)
    await sleep(1200)
    // Walk the page so IntersectionObserver-gated figures build themselves.
    await page.eval(`(async()=>{const h=document.body.scrollHeight;for(let y=0;y<h;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,180))}window.scrollTo(0,0);return 1})()`)
    await page.eval(SETTLE)
    await sleep(1200)

    const box = await page.eval(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return null
        el.scrollIntoView({ block: 'center' })
        const r = el.getBoundingClientRect()
        return JSON.stringify({ x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height })
      })()
    `)
    if (!box) throw new Error(`selector ${selector} matched nothing`)
    await sleep(700)

    const b = JSON.parse(box)
    const png = await page.screenshot({
      clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 },
    })
    const out = join(shotsDir, `${slug}.png`)
    await writeFile(out, png)
    return { path: out, w: Math.round(b.w), h: Math.round(b.h), bytes: png.length }
  } finally {
    await page.close()
  }
}

async function renderCard(chrome, article, shotPath, shotAspect) {
  const page = await newPage(chrome.port, { width: 1200, height: 630, scale: 1 })
  try {
    const params = new URLSearchParams({
      title: article.title,
      kicker: article.kicker,
      shot: pathToFileURL(shotPath).href,
      ...(article.dim ? { dim: String(article.dim) } : {}),
      ...(shotAspect ? { aspect: shotAspect.toFixed(3) } : {}),
    })
    await page.goto(`${pathToFileURL(join(here, 'card.html')).href}?${params}`)
    // Webfonts land after load; capturing before they do gives a fallback face.
    await page.eval('document.fonts.ready.then(() => 1)')
    await sleep(600)
    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
    })
    const dest = resolve(homedir(), article.out)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, png)
    return { dest, bytes: png.length }
  } finally {
    await page.close()
  }
}

const manifest = JSON.parse(await readFile(join(here, 'articles.json'), 'utf8'))
const wanted = process.argv.slice(2)
const todo = wanted.length
  ? manifest.articles.filter((a) => wanted.includes(a.slug))
  : manifest.articles

await mkdir(shotsDir, { recursive: true })
const chrome = await launchChrome()
let failed = 0
try {
  for (const article of todo) {
    try {
      // `image` wins over `selector`: a couple of these repos already ship
      // purpose-made art, and a committed PNG beats re-capturing a live page.
      const shot = article.image
        ? { path: resolve(homedir(), article.image), w: 0, h: 0 }
        : await captureFigure(chrome, article)
      const card = await renderCard(chrome, article, shot.path, shot.w ? shot.w / shot.h : 0)
      const src = shot.w ? `figure ${shot.w}x${shot.h}` : 'local image  '
      console.log(`ok   ${article.slug.padEnd(24)} ${src} -> ${card.dest.replace(homedir(), '~')} (${(card.bytes / 1024).toFixed(0)} kB)`)
    } catch (e) {
      failed++
      console.error(`FAIL ${article.slug.padEnd(24)} ${e.message}`)
    }
  }
} finally {
  await chrome.close()
}
process.exit(failed ? 1 : 0)
