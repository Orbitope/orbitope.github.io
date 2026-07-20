# Orbitope — orbitope.github.io

The Orbitope landing page. A single self-contained `index.html` — all styles,
scripts, the logo (inline SVG), and the favicon are embedded. Fonts load from
Google Fonts. No build step, no dependencies.

## Deploy to GitHub Pages

1. Create a new repository named **`orbitope.github.io`**
   (replace `orbitope` with your GitHub username/org — for the org account it's
   literally `orbitope.github.io`).
2. Upload **`index.html`** and **`.nojekyll`** to the repo root.
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** →
   Branch: `main` / folder: `/ (root)` → **Save**.
4. Live at **https://orbitope.github.io** within ~60 seconds.

## Editing

- **Links** — search `index.html` for `github.com` and the `mailto:` to update
  destinations. The YouTube, X, and Instagram buttons were removed while those
  accounts are empty; the `.link-btn` styling still supports them, so adding one
  back is a matter of pasting the anchor into `.links`.
- **Tagline / description** — the `.tagline` and `.desc` elements near the
  bottom of the `<body>`.
- **Projects** — the `.project-grid` section. Copy a `.project` block to add
  one; the `.entries` list under it is optional (RLevator has none).
- **Colors** — the `:root` block at the top of the `<style>` (Palette B:
  charcoal + amber + steel).

### Project list layout

`.project-grid` owns the layout; `.project` makes no assumptions about its own
width. To go from a two-column grid to a single-column list, change one line:

```css
grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));  /* grid */
grid-template-columns: 1fr;                                              /* list */
```

Keep the `min(360px, 100%)` wrapper. A bare `minmax(360px, 1fr)` outweighs the
container on narrow screens and scrolls the page sideways on a phone.

## Project pages live in their own repos

Each project's article/site is served from its own repo via GitHub Pages, not
from here — see `Orbitope/pushman` (`main:/docs`) and `Orbitope/RLevator`
(`main:/docs`). This repo only holds the landing page that links to them.

**GitHub Pages project paths are case-sensitive.** The path segment must match
the repo name exactly: `/RLevator/` resolves, `/rlevator/` returns a 404 with no
redirect attempt. (Confusingly, repo URLs on `github.com` *are*
case-insensitive.) The `rlevator/` directory here is a redirect stub that
catches the lowercase spelling; `/RLevator/` stays canonical.

## Files

| File                  | Purpose                                         |
|-----------------------|-------------------------------------------------|
| `index.html`          | The landing page — the entire site.             |
| `rlevator/index.html` | Lowercase redirect to canonical `/RLevator/`.   |
| `.nojekyll`           | Tells GitHub Pages to serve files as-is.        |
