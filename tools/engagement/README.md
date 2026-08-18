# engagement

The analytics events every article emits, and the script that installs them.

## Why these events exist

GA4's enhanced measurement gives a pageview and a single scroll event at 90%.
For this site that leaves the two questions actually worth asking unanswered:

- **Was a figure touched at all?** These articles argue by demonstration — the
  house rule is that if a claim can be shown rather than stated, build the
  demonstration. Nothing in the default setup says whether anyone uses them.
- **Where do people stop?** One event at 90% cannot separate a reader who
  bounced at the first chart from one who read the whole piece.

| event | when | params |
|---|---|---|
| `read_depth` | 25 / 50 / 75 / 100 % | `percent` |
| `widget_interact` | first touch of each figure, once per figure | `id` |
| `crosslink_click` | the inline links to sibling articles | `link_url` |

`widget_interact` fires once per figure on purpose: the question is "used", not
"used a lot", and a slider drag would otherwise bury everything under a hundred
identical events.

## Installing it

```bash
python3 add-engagement.py
```

Injects `engagement.js` inline into each hand-written `docs/index.html`, fenced
by `<!-- orbitope:engagement:start -->` markers. Re-running **replaces** what is
between them, which is how an edit to `engagement.js` reaches pages that already
carry an older copy. It asserts the GA4 tag survives and that the block is never
duplicated.

Inline rather than a shared `<script src>` because these pages are deliberately
self-contained — open the file and it works. A cross-repo script tag would make
every article's analytics depend on a file in a different repository.

**Kangaroos is not in that list.** It builds from source, so its copy lives at
`apps/article/src/engagement.js` in its own repo and is imported with `?raw` by
`SiteHead.astro`. Changing the events here means copying the file there too.

## After changing engagement.js

Run [`../og-card/verify-events.mjs`](../og-card/README.md). Two bugs got through
before it existed: an end-of-article detector that reported a completed read to
every visitor of a page that hydrates after load, and depth marks that stopped
firing entirely.

## Reporting them in GA4

The parameters are collected but **not reportable** until each is registered as
a custom dimension: Admin → Custom definitions → Create custom dimension, scope
Event, for `percent`, `id`, and `link_url`. Without that they exist in the data
and cannot be broken out in any report.
