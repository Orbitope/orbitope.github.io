/*
 * Verifies the engagement events actually fire, on every article.
 *
 * Reads window.dataLayer rather than stubbing gtag: the page's own GA snippet
 * defines gtag itself, so any stub installed before navigation is overwritten,
 * and one installed after misses everything that fired during load. dataLayer
 * is where the real calls land either way.
 *
 * Google's endpoints are blocked, which both keeps test hits out of the real
 * property and leaves gtag as the inline dataLayer shim rather than the remote
 * implementation — exactly what we want to observe.
 */
import { launchChrome, newPage, sleep } from './cdp.mjs'
import { pathToFileURL } from 'node:url'

const REPOS = [
  'projects/smurf_hunting', 'projects/coldopen', 'projects/contact-patch',
  'projects/simulacrum', 'projects/hextruchet', 'unity_projects/gridlocked-game',
  'unity_projects/Pushman', 'unity_projects/RLevator',
]

const events = (page) => page.eval(
  `JSON.stringify(Array.from(window.dataLayer || []).map(a => Array.from(a))
     .filter(a => a[0] === 'event').map(a => [a[1], (a[2] && a[2].percent) || (a[2] && a[2].id) || '']))`
)

const chrome = await launchChrome()
let bad = 0
console.log('page                on-load    depths after full read   widget  xref')
for (const rel of REPOS) {
  const page = await newPage(chrome.port, { width: 1280, height: 900, scale: 1 })
  await page.send('Network.enable')
  await page.send('Network.setBlockedURLs', {
    urls: ['*googletagmanager.com*', '*google-analytics.com*', '*analytics.google.com*'],
  })
  await page.goto(pathToFileURL(process.env.HOME + '/' + rel + '/docs/index.html').href)
  await sleep(1000)

  const onLoad = JSON.parse(await events(page)).map((e) => e[0])

  await page.eval(`document.documentElement.style.scrollBehavior='auto'
    document.body.style.scrollBehavior='auto'
    document.addEventListener('click', function (e) { e.preventDefault() }, true); 1`)
  await page.eval(`(async () => { let stable = 0
    while (stable < 4) { const b = Math.round(scrollY)
      window.scrollTo(0, document.documentElement.scrollHeight)
      await new Promise(r => setTimeout(r, 220))
      if (Math.round(scrollY) === b) stable++; else stable = 0 }
    return 1 })()`)
  await sleep(500)
  await page.eval(`(() => { const s = document.querySelector('svg,canvas')
    if (s) s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    const a = document.querySelector('a.xref')
    if (a) a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return 1 })()`)
  await sleep(250)

  const all = JSON.parse(await events(page))
  const depths = all.filter((e) => e[0] === 'read_depth').map((e) => Number(e[1])).sort((a, b) => a - b)
  const widget = all.filter((e) => e[0] === 'widget_interact').length
  const xref = all.filter((e) => e[0] === 'crosslink_click').length

  // On load, only the pageview should exist — a read_depth here means the
  // end-of-article detector is firing for people who have read nothing.
  const loadOk = !onLoad.includes('read_depth')
  const ok = loadOk && [25, 50, 75, 100].every((m) => depths.includes(m)) && widget > 0
  if (!ok) bad++
  console.log(
    `${rel.split('/').pop().padEnd(19)} ${(onLoad.join(',') || 'none').padEnd(10)} ` +
    `[${depths.join(',')}]`.padEnd(24) + ` ${String(widget).padEnd(7)} ${xref}   ${ok ? '' : '<-- FAIL'}`
  )
  await page.close()
}
await chrome.close()
console.log(bad ? `\n${bad} page(s) failed` : '\nall pages ok')
process.exit(bad ? 1 : 0)
