#!/usr/bin/env python3
"""Edit an Orbitope article's text in the browser, on the page as it looks when published.

    python3 tools/edit-article/edit.py leyline            # an article folder in this repo
    python3 tools/edit-article/edit.py ~/projects/simulacrum/docs/index.html

It serves the page on http://127.0.0.1:8790/ with its headings, paragraphs, list items and captions made
editable, and a bar to save. Save writes only the elements you changed back into the file; `git diff` shows
what changed. Nothing is added to the published page: the editor is injected while serving.

Text that a figure's script draws (matrix cells, step cards) is not in the HTML source as elements, so it is
not editable here. Quoted output in <pre> blocks, code, scripts and styles are left alone.

Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import webbrowser
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EDITABLE = {"h1", "h2", "h3", "h4", "p", "li", "figcaption", "td", "th", "blockquote"}
EDITABLE_CLASSES = {"eyebrow", "kicker", "sub", "cap"}          # divs that hold prose
SKIP_INSIDE = {"pre", "script", "style", "svg", "code", "button", "select", "textarea", "head"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
GA_IDS = ["G-KG3409EZDQ"]


class Spans(HTMLParser):
    """Finds each editable element's inner span (start, end offsets) in the source text.

    An element is editable when its tag (or, for a div, its class) says it holds prose, it is not inside
    a skipped element, and no editable element is nested inside it (the innermost one is edited)."""

    def __init__(self, text: str):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.line_starts = [0]
        for i, ch in enumerate(text):
            if ch == "\n":
                self.line_starts.append(i + 1)
        self.stack: list[dict] = []
        self.spans: list[tuple[int, int, int]] = []    # (start of start tag, inner start, inner end)

    def _offset(self) -> int:
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self._offset()
        raw = self.get_starttag_text() or ""
        if tag in VOID:
            return
        classes = set((dict(attrs).get("class") or "").split())
        skipped = tag in SKIP_INSIDE or any(e["skipped"] for e in self.stack)
        editable = not skipped and (tag in EDITABLE or (tag == "div" and classes & EDITABLE_CLASSES))
        if editable:
            for e in self.stack:
                e["has_editable_child"] = True
        self.stack.append({"tag": tag, "start": start, "inner": start + len(raw), "editable": editable,
                           "skipped": skipped, "has_editable_child": False})

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        end = self._offset()
        # Close up to the matching open tag; HTML lets some end tags be left out (p, li, td).
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                closing = self.stack[i:]
                del self.stack[i:]
                for e in reversed(closing):
                    if e["editable"] and not e["has_editable_child"]:
                        self.spans.append((e["start"], e["inner"], end))
                return


def find_spans(text: str) -> list[tuple[int, int, int]]:
    p = Spans(text)
    p.feed(text)
    p.close()
    return sorted(p.spans)


def instrument(text: str) -> tuple[str, list[tuple[int, int]]]:
    """The page with data-edit="n" on each editable element, the editor injected, and analytics off."""
    spans = find_spans(text)
    out, last, inner = [], 0, []
    for n, (tag_start, inner_start, inner_end) in enumerate(spans):
        name_end = tag_start + 1
        while name_end < len(text) and (text[name_end].isalnum()):
            name_end += 1
        out.append(text[last:name_end])
        out.append(f' data-edit="{n}"')
        last = name_end
        inner.append((inner_start, inner_end))
    out.append(text[last:])
    page = "".join(out)
    off = "".join(f"window['ga-disable-{g}']=true;" for g in GA_IDS)
    page = page.replace("<head>", f"<head><script>{off}window.__orbitopeEditing=true;</script>", 1)
    editor = (Path(__file__).parent / "editor.js").read_text(encoding="utf-8")
    page = page.replace("</body>", f"<script>{editor}</script></body>", 1)
    return page, inner


def apply_edits(text: str, edits: dict[int, str]) -> str:
    spans = [(a, b) for (_, a, b) in find_spans(text)]
    for n in sorted(edits, key=lambda k: spans[k][0], reverse=True):
        a, b = spans[n]
        text = text[:a] + edits[n] + text[b:]
    return text


def resolve(target: str) -> Path:
    p = Path(target).expanduser()
    if p.is_dir():
        p = p / "index.html"
    if not p.exists():
        q = REPO / target / "index.html"
        if q.exists():
            p = q
    if not p.exists():
        sys.exit(f"edit.py: no page at {target} (give an article folder in this repo, or a path to an .html file)")
    return p.resolve()


def main() -> int:
    ap = argparse.ArgumentParser(description="Edit an Orbitope article's text in the browser.")
    ap.add_argument("page", help="an article folder in this repo (leyline), or a path to its .html file")
    ap.add_argument("--port", type=int, default=8790)
    ap.add_argument("--no-open", action="store_true", help="do not open a browser")
    args = ap.parse_args()
    page = resolve(args.page)
    root = page.parent

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)

        def log_message(self, fmt, *a):
            pass

        def _send(self, code: int, body: bytes, ctype: str):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path.split("?")[0] in ("/", "/" + page.name):
                text = page.read_text(encoding="utf-8")
                html, _ = instrument(text)
                digest = hashlib.sha256(text.encode()).hexdigest()
                html = html.replace("window.__orbitopeEditing=true;",
                                    f"window.__orbitopeEditing=true;window.__orbitopeBase='{digest}';", 1)
                return self._send(200, html.encode("utf-8"), "text/html; charset=utf-8")
            return super().do_GET()

        def do_POST(self):
            if self.path != "/__save":
                return self._send(404, b"not found", "text/plain")
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            text = page.read_text(encoding="utf-8")
            if body.get("base") != hashlib.sha256(text.encode()).hexdigest():
                msg = {"ok": False, "error": "The file changed on disk since this page loaded. Reload, then make the edits again."}
                return self._send(409, json.dumps(msg).encode(), "application/json")
            edits = {int(k): v for k, v in (body.get("edits") or {}).items()}
            n_spans = len(find_spans(text))
            if any(k < 0 or k >= n_spans for k in edits):
                return self._send(400, json.dumps({"ok": False, "error": "unknown element"}).encode(), "application/json")
            new = apply_edits(text, edits)
            page.write_text(new, encoding="utf-8")
            msg = {"ok": True, "saved": len(edits), "base": hashlib.sha256(new.encode()).hexdigest()}
            return self._send(200, json.dumps(msg).encode(), "application/json")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Editing {page}\nOpen {url}  (Ctrl+C to stop; then `git diff` to see what changed)")
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
