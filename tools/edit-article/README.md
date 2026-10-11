# edit-article

Edit an article's text in the browser, on the page as it looks when published, and save it back into the
HTML file.

```bash
python3 tools/edit-article/edit.py leyline                       # an article folder in this repo
python3 tools/edit-article/edit.py ~/projects/simulacrum/docs     # or an article in another repo
```

It opens `http://127.0.0.1:8790/`. Click any heading, paragraph, list item, caption or eyebrow and type. The bar
at the bottom counts what you changed; **Save** (or Cmd/Ctrl+S) writes those elements, and only those, into the
file. Then `git diff` shows the change. Stop the server with Ctrl+C.

- Enter does nothing inside an element (each one stays one block), and paste comes in as plain text.
- Links stay links. Cmd/Ctrl+click follows one.
- Analytics is switched off while editing, and the editor is injected as the page is served, so nothing is
  added to the published file.
- If the file changed on disk after the page loaded (an editor, git), Save refuses; reload and edit again.

Not editable here: text a figure's script draws (matrix cells, step cards, anything built from a JS array),
quoted tool output in `<pre>`, code, and the `<head>` (title and meta tags). Edit those in the source, or ask
Claude to.

Standard library only (Python 3.9+).
