# og-card

Generates the 1200×630 social card for every page listed in `articles.json`,
and holds the two scripts that did the one-off head edits across the article
repos.

## Why it captures live pages

The articles draw their figures at runtime — canvas and SVG built by each
page's own JavaScript. There is no source image to copy, so the only way to put
the *real* artifact on the card (rather than a mockup of it) is to load the
published page and screenshot the figure.

## Why CDP instead of `chrome --screenshot`

The pages reveal figures on scroll, so a plain viewport capture gets a
mid-transition frame or an empty one. `cdp.mjs` is a ~150-line DevTools
Protocol client over Node's built-in `WebSocket` — no puppeteer, which would
otherwise be the largest thing in a repo whose build step is "commit an HTML
file". It scrolls, freezes animations, waits for paint, and clips to an element.

## Use

```bash
node generate.mjs                 # every article
node generate.mjs sharkhunt       # one, by slug
```

Cards are written straight into each article's own repo (`out` in the
manifest), because that is where GitHub Pages serves them from.

## Adding an article

One entry in `articles.json`:

- `selector` — the figure to capture. Two traps, both hit while building this:
  - **Not a hero or backdrop element.** Clipping is by bounding box, so a
    decorative full-width SVG behind the hero captures everything drawn on top
    of it — the card ends up printing the article title twice.
  - **Not an empty interactive surface.** A game board or sandbox that starts
    blank captures blank. Pick the figure that is already populated.

  Pick something that reads at thumbnail size, not the most detailed chart.
- `image` — use instead of `selector` when the repo already ships suitable art.
- `find` — a JS expression returning the element, for figures no CSS selector
  reaches. The kangaroos world figure is an anonymous container found by the
  heading it follows.
- `settleMs` — extra wait after scrolling to the target. WebGL scenes need
  seconds under SwiftShader.
- `out` — path relative to `$HOME`.

Then add a `<url>` block to `sitemap.xml` in the repo root.

## Capturing WebGL scenes

They work, but two things have to be right and neither is obvious:

1. **SwiftShader must be on.** Headless Chrome has no GPU and `webgl` is simply
   `false` without `--enable-unsafe-swiftshader`, so a Three.js scene never
   builds. It is a CPU rasteriser, so give those figures seconds to draw —
   `settleMs` in the manifest, not the 700 ms default.
2. **Do not scroll away from the target.** The kangaroos article unmounts a
   scene once it leaves the viewport (browsers cap live WebGL contexts around
   8–16 and it has fifteen 3D figures). Scroll to the figure, stay there, wait.
   Walking the page and coming back finds nothing but an empty placeholder —
   which looks exactly like "WebGL is unavailable" and is not.

## Known limits

- Cards are exactly 1200×630 to match the declared `og:image:width/height`.

## Layout

Chosen automatically from the captured figure's aspect ratio:

- **< 1.5** (square/tall) — contained panel beside the headline. Cover-cropping
  a square into a wide strip shows only its middle and usually misses the
  subject entirely.
- **1.5–2.6** — band across the top two-thirds, cover-cropped.
- **> 2.6** (very wide) — band, but contained, so the ends survive. They often
  carry the labels the headline refers to.

## The one-off scripts

`add-meta.py` and `add-crosslinks.py` performed the original pass across the
eight hand-written `docs/index.html` articles. Both are idempotent and both
assert the GA4 tag survives, so they are safe to re-run — useful if a new
article joins the set.

## verify-events.mjs

Checks the analytics events in [`../engagement`](../engagement/) actually fire,
on every article. Run it after changing `engagement.js`:

```bash
node verify-events.mjs
```

It drives a real browser per page: asserts nothing fires on load, rides the page
to its true bottom, then checks all four depth marks plus a widget touch and a
cross-link click. It reads `window.dataLayer` with Google's endpoints blocked —
so it exercises the real code path and cannot put test hits in the property.

Two things it exists to catch, both of which happened:

- an end-of-article detector that fired for *every* visitor on pages that
  hydrate after load, and
- depth marks that silently stopped firing.

Note that these pages use `scroll-behavior: smooth`, so a test that scrolls
programmatically must disable it first or the page barely moves and every
assertion fails for the wrong reason.
