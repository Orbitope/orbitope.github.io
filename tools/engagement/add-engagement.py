#!/usr/bin/env python3
"""
Injects engagement.js inline into each hand-written article.

Inline rather than a shared <script src>: these pages are deliberately
self-contained — open the file, it works, no build and no network beyond fonts.
A cross-repo script tag would make every article's analytics depend on a file
in a different repository.

The cost of inlining is eight copies, so this script owns them. The block is
fenced by markers and re-running REPLACES what is between them, which is how a
change to engagement.js reaches pages that already have an older copy.
"""
import re
import sys
from pathlib import Path

HOME = Path.home()
HERE = Path(__file__).resolve().parent
START = "<!-- orbitope:engagement:start -->"
END = "<!-- orbitope:engagement:end -->"

ARTICLES = [
    "projects/smurf_hunting/docs/index.html",
    "projects/coldopen/docs/index.html",
    "projects/contact-patch/docs/index.html",
    "projects/simulacrum/docs/index.html",
    "projects/hextruchet/docs/index.html",
    "unity_projects/gridlocked-game/docs/index.html",
    "unity_projects/Pushman/docs/index.html",
    "unity_projects/RLevator/docs/index.html",
]


def block():
    js = (HERE / "engagement.js").read_text().rstrip()
    return f"{START}\n<script>\n{js}\n</script>\n{END}\n"


def main():
    new = block()
    added = updated = 0
    for rel in ARTICLES:
        path = HOME / rel
        if not path.exists():
            print(f"MISS {rel}")
            continue
        html = path.read_text()

        if START in html:
            html = re.sub(
                re.escape(START) + r".*?" + re.escape(END) + r"\n?",
                new,
                html,
                flags=re.S,
            )
            action = "updated"
            updated += 1
        else:
            i = html.rindex("</body>")
            html = html[:i] + new + html[i:]
            action = "added  "
            added += 1

        # Both of these have been lost in edits to this file set before.
        assert "G-KG3409EZDQ" in html, f"{rel}: analytics tag lost"
        assert html.count(START) == 1, f"{rel}: duplicated engagement block"
        path.write_text(html)
        print(f"{action} {rel}")

    print(f"\n{added} added, {updated} updated")


if __name__ == "__main__":
    sys.exit(main())
