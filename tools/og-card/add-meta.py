#!/usr/bin/env python3
"""
Adds the canonical/social/JSON-LD tag block to each hand-written article head.

These eight pages are self-contained docs/index.html files with no build step
and no shared template, so the same block has to be inserted into each one.
The insertion is anchored to the existing `og:type` line rather than a line
number because the heads are not identically ordered — RLevator puts its OG
tags before the analytics snippet, the rest put them after.

Idempotent: a page that already has a canonical tag is left alone.
"""
import json
import re
import sys
from pathlib import Path

HOME = Path.home()

ARTICLES = [
    # (repo docs/index.html, live path, ISO publication date)
    ("projects/smurf_hunting/docs/index.html",          "sharkhunt",              "2026-08-01"),
    ("projects/coldopen/docs/index.html",               "coldopen",               "2026-08-01"),
    ("projects/contact-patch/docs/index.html",          "contactpatch",           "2026-08-01"),
    ("projects/simulacrum/docs/index.html",             "simulacrum",             "2026-07-01"),
    ("projects/hextruchet/docs/index.html",             "hextruchet",             "2026-07-01"),
    ("unity_projects/gridlocked-game/docs/index.html",  "gridlocked",             "2026-07-01"),
    ("unity_projects/Pushman/docs/index.html",          "pushman",                "2026-07-01"),
    ("unity_projects/RLevator/docs/index.html",         "RLevator",               "2026-07-01"),
]

BASE = "https://orbitope.com"


def text_of(html, pattern):
    m = re.search(pattern, html)
    return m.group(1).strip() if m else ""


def build_block(html, slug, date, indent):
    url = f"{BASE}/{slug}/"
    img = f"{url}og.png"
    title = text_of(html, r'<meta property="og:title" content="([^"]*)"') or text_of(html, r"<title>([^<]*)</title>")
    desc = text_of(html, r'<meta property="og:description" content="([^"]*)"') or text_of(html, r'<meta name="description" content="([^"]*)"')

    ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": desc,
        "image": img,
        "url": url,
        "datePublished": date,
        "author": {"@type": "Person", "name": "Matthew Burke"},
        "publisher": {"@type": "Organization", "name": "Orbitope"},
    }
    lines = [
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{img}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<link rel="canonical" href="{url}">',
        '<script type="application/ld+json">',
        json.dumps(ld, ensure_ascii=False),
        '</script>',
    ]
    return "\n".join(indent + l for l in lines)


def main():
    changed = 0
    for rel, slug, date in ARTICLES:
        path = HOME / rel
        if not path.exists():
            print(f"MISS {slug:14} {path} not found")
            continue
        html = path.read_text()

        if 'rel="canonical"' in html:
            print(f"skip {slug:14} already has canonical")
            continue

        m = re.search(r'^([ \t]*)<meta property="og:type"[^>]*>[ \t]*$', html, re.M)
        if not m:
            print(f"FAIL {slug:14} no og:type anchor line")
            continue

        block = build_block(html, slug, date, m.group(1))
        html = html[: m.end()] + "\n" + block + html[m.end():]

        # The analytics tag has gone missing on these pages before, so treat
        # losing it as a hard failure rather than something to notice later.
        assert "G-KG3409EZDQ" in html, f"{slug}: analytics tag lost"
        path.write_text(html)
        print(f"ok   {slug:14} {rel}")
        changed += 1
    print(f"\n{changed} file(s) patched")


if __name__ == "__main__":
    sys.exit(main())
