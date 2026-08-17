/**
 * A minimal Chrome DevTools Protocol client.
 *
 * There is no puppeteer here on purpose: Node 22+ ships a global WebSocket, and
 * everything this needs is four CDP commands. Adding a 300MB browser-automation
 * dependency to a repo whose entire build step is "commit an HTML file" would
 * be the largest thing in it.
 *
 * The reason we drive CDP at all rather than `chrome --screenshot`: the
 * articles reveal their figures on scroll, so a naive viewport capture gets a
 * mid-transition frame or an empty one. We need to scroll, kill the
 * animations, wait for the canvases to actually paint, and clip to an element.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export async function launchChrome({ port = 9222 } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'ogcard-'))
  const proc = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    // The kangaroos terrain figures are Three.js. Headless Chrome has no GPU,
    // and without a software rasteriser `webgl` is simply false there, so the
    // scenes stay blank and the capture is of nothing. SwiftShader is the CPU
    // fallback; it is slow, which is why the scene captures get a longer wait.
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--force-device-scale-factor=2', // retina cards; social feeds are dense displays
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--allow-file-access-from-files',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  // Chrome prints the devtools URL on stderr when the port is live. Polling the
  // JSON endpoint is more reliable than parsing that line across versions.
  const deadline = Date.now() + 20_000
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) break
    } catch {}
    if (Date.now() > deadline) throw new Error('Chrome did not open a debugging port')
    await new Promise((r) => setTimeout(r, 150))
  }
  return {
    port,
    async close() {
      proc.kill()
      await rm(profile, { recursive: true, force: true }).catch(() => {})
    },
  }
}

/** Open a fresh tab and return a command channel onto it. */
export async function newPage(port, { width, height, scale = 2 }) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })

  let id = 0
  const pending = new Map()
  const events = new Map()
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
    } else if (msg.method && events.has(msg.method)) {
      events.get(msg.method).forEach((fn) => fn(msg.params))
      events.delete(msg.method)
    }
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id
      pending.set(n, { resolve, reject })
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  const once = (method) =>
    new Promise((resolve) => {
      if (!events.has(method)) events.set(method, [])
      events.get(method).push(resolve)
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: scale, mobile: false,
  })

  return {
    send,
    once,
    /** Evaluate in the page and return the (JSON-serializable) value. */
    async eval(expression) {
      const r = await send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
      })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
      return r.result.value
    },
    async goto(url) {
      const loaded = once('Page.loadEventFired')
      await send('Page.navigate', { url })
      await loaded
    },
    async screenshot({ clip } = {}) {
      const r = await send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: Boolean(clip), ...(clip ? { clip } : {}),
      })
      return Buffer.from(r.data, 'base64')
    },
    async close() {
      ws.close()
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
    },
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
