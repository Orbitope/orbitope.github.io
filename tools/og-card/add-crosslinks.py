#!/usr/bin/env python3
"""
Adds inline cross-links between articles.

Each link replaces an existing phrase in the prose — nothing is added to the
copy. The phrase has to already be about the thing being linked to, which is
why these are hand-picked rather than generated: a "see also" block bolted to
the end is easy to produce and easy to ignore.

Not every page styles a bare <a>, so a small .xref rule goes in alongside, and
the links carry that class. Idempotent: a page that already has .xref is left
alone.
"""
import sys
from pathlib import Path

HOME = Path.home()
XREF_CSS = (
    "\n/* Inline links to sibling Orbitope articles. Scoped to its own class "
    "because these pages do not all style a bare <a>. */\n"
    ".xref{color:var(--amber-bright,#E8C068);text-decoration:none;"
    "border-bottom:1px solid rgba(232,192,104,.38);transition:border-color .2s}\n"
    ".xref:hover{border-bottom-color:var(--amber-bright,#E8C068)}\n"
)

# (file, phrase to wrap, destination, why this pairing is honest)
LINKS = [
    ("projects/smurf_hunting/docs/index.html",
     "matchmaking eventually sorts it out",
     "https://orbitope.com/coldopen/",
     "the smurf case resolves by rating a new account, which is Cold Open's subject"),

    ("projects/coldopen/docs/index.html",
     "A rating built from wins and losses didn't help",
     "https://orbitope.com/sharkhunt/",
     "Shark Hunt is exactly the proof that wins and losses are the wrong evidence"),

    ("unity_projects/gridlocked-game/docs/index.html",
     "The obvious measure of difficulty turns out to be worthless.",
     "https://orbitope.com/hextruchet/",
     "Hex Truchet hits the same wall: its search strength won't work as a difficulty dial"),

    ("projects/hextruchet/docs/index.html",
     "useless as a difficulty dial",
     "https://orbitope.com/gridlocked/",
     "Gridlocked is the corpus-scale version of what difficulty actually tracks"),

    ("projects/contact-patch/docs/index.html",
     "The car is driven by a minimum-time solver",
     "https://orbitope.com/optimization-kangaroos/",
     "Kangaroos is the tour of how solvers like this one actually search"),

    ("projects/simulacrum/docs/index.html",
     "Teaching an agent to play it",
     "https://orbitope.com/pushman/",
     "Pushman is what those millions of steps look like when the training goes wrong"),

    ("unity_projects/Pushman/docs/index.html",
     "an impressive number of wrong ways to train a reinforcement-learning agent",
     "https://orbitope.com/RLevator/",
     "RLevator is the same stack aimed at a control problem instead of a fight"),

    ("unity_projects/RLevator/docs/index.html",
     "It looks harmless. Keep it in mind",
     "https://orbitope.com/pushman/",
     "Pushman is the other half of this lesson: a sane-looking reward that quietly kills a strategy"),
]


def main():
    ok = fail = 0
    for rel, phrase, href, _why in LINKS:
        path = HOME / rel
        if not path.exists():
            print(f"MISS {rel}"); fail += 1; continue
        html = path.read_text()

        n = html.count(phrase)
        if n != 1:
            print(f"FAIL {path.name:12} {rel.split('/')[-3]:16} phrase occurs {n}x: {phrase[:50]!r}")
            fail += 1
            continue
        if f'href="{href}"' in html:
            print(f"skip {rel.split('/')[-3]:16} already links there"); continue

        html = html.replace(phrase, f'<a class="xref" href="{href}">{phrase}</a>', 1)
        if ".xref{" not in html:
            i = html.rindex("</style>")
            html = html[:i] + XREF_CSS + html[i:]

        assert "G-KG3409EZDQ" in html, f"{rel}: analytics tag lost"
        path.write_text(html)
        print(f"ok   {rel.split('/')[-3]:16} -> {href}")
        ok += 1
    print(f"\n{ok} linked, {fail} failed")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
