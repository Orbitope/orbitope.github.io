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

- **Links** — search `index.html` for `youtube.com`, `github.com`, `x.com`,
  `instagram.com`, and the `mailto:` to update destinations.
- **Tagline / description** — the `.tagline` and `.desc` elements near the
  bottom of the `<body>`.
- **Colors** — the `:root` block at the top of the `<style>` (Palette B:
  charcoal + amber + steel).

## Files

| File         | Purpose                                            |
|--------------|----------------------------------------------------|
| `index.html` | The entire site.                                   |
| `.nojekyll`  | Tells GitHub Pages to serve files as-is.           |
