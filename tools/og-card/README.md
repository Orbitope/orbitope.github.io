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

- `selector` — the figure to capture. Pick something that reads at thumbnail
  size, not the most detailed chart, and **not** a hero element: those contain
  the headline already and the card ends up saying it twice.
- `image` — use instead of `selector` when the repo already ships suitable art.
- `out` — path relative to `$HOME`.

Then add a `<url>` block to `sitemap.xml` in the repo root.

## Known limits

- **WebGL figures need a real GPU.** Headless Chrome runs SwiftShader
  (`--enable-unsafe-swiftshader`), which is enough for `webgl` to exist but not
  for the kangaroos Three.js terrain scenes to mount — they stay blank. That
  article uses a 2D figure instead.
- Cards are exactly 1200×630 to match the declared `og:image:width/height`.

## The one-off scripts

`add-meta.py` and `add-crosslinks.py` performed the original pass across the
eight hand-written `docs/index.html` articles. Both are idempotent and both
assert the GA4 tag survives, so they are safe to re-run — useful if a new
article joins the set.
