/* Injected by tools/edit-article/edit.py while editing. Never part of the published page. */
(function () {
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-edit]'));
  var original = {};
  var dirty = {};   // only elements you typed into: a figure's script redrawing one is not an edit
  var base = window.__orbitopeBase;

  var css = document.createElement('style');
  css.textContent =
    '[data-edit]{outline:1px dashed transparent;outline-offset:3px;cursor:text;transition:outline-color .15s}' +
    '[data-edit]:hover{outline-color:rgba(232,192,104,.45)}' +
    '[data-edit]:focus{outline:1px solid #E8C068;background:rgba(232,192,104,.06)}' +
    '[data-edit].oe-changed{outline:1px solid rgba(102,132,66,.9)}' +
    '.oe-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;' +
    'align-items:center;padding:10px 14px;background:#1b1a14;border:1px solid #C49A3C;border-radius:10px;' +
    'font:13px/1.3 "JetBrains Mono",monospace;color:#e9e3d2;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
    '.oe-bar button{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid #C49A3C;background:#2a2619;' +
    'color:#E8C068;cursor:pointer}.oe-bar button:disabled{opacity:.4;cursor:default}' +
    '.oe-bar .oe-msg{max-width:46ch}';
  document.head.appendChild(css);

  els.forEach(function (el) {
    original[el.dataset.edit] = el.innerHTML;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.addEventListener('input', function () { dirty[el.dataset.edit] = true; update(); });
    // One element is one block: Enter would split it into markup the source doesn't have.
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    });
    // Paste as plain text, so no styles or spans come in from elsewhere.
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\n\s*/g, ' ');
      document.execCommand('insertText', false, t);
    });
    // Links stay links while editing; follow one with Cmd/Ctrl+click.
    el.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && !(e.metaKey || e.ctrlKey)) e.preventDefault();
    });
  });

  var bar = document.createElement('div');
  bar.className = 'oe-bar';
  bar.innerHTML = '<span class="oe-msg">Click any text to edit it.</span>' +
    '<button type="button" class="oe-discard" disabled>Discard</button>' +
    '<button type="button" class="oe-save" disabled>Save</button>';
  document.body.appendChild(bar);
  var msg = bar.querySelector('.oe-msg'), saveBtn = bar.querySelector('.oe-save'),
      discardBtn = bar.querySelector('.oe-discard');
  saveBtn.addEventListener('click', save);
  discardBtn.addEventListener('click', function () {
    if (confirm('Discard every unsaved edit on this page?')) location.reload();
  });

  function clean(html) {
    return html.replace(/<br\s*\/?>\s*$/i, '').replace(/&nbsp;/g, function (m, i, s) {
      return /\s/.test(s[i - 1] || '') || /\s/.test(s[i + 6] || '') ? ' ' : m;
    });
  }

  function changed() {
    var out = {};
    els.forEach(function (el) {
      if (!dirty[el.dataset.edit]) return;
      var now = clean(el.innerHTML);
      if (now !== original[el.dataset.edit]) out[el.dataset.edit] = now;
      el.classList.toggle('oe-changed', now !== original[el.dataset.edit]);
    });
    return out;
  }

  function update() {
    var n = Object.keys(changed()).length;
    saveBtn.disabled = discardBtn.disabled = n === 0;
    msg.textContent = n ? n + ' changed. Save writes them to the file (Cmd/Ctrl+S).' : 'Click any text to edit it.';
  }

  function save() {
    var edits = changed();
    if (!Object.keys(edits).length) return;
    saveBtn.disabled = true;
    msg.textContent = 'Saving…';
    fetch('/__save', {method: 'POST', headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({base: base, edits: edits})})
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) { msg.textContent = r.error; saveBtn.disabled = false; return; }
        base = r.base;
        Object.keys(edits).forEach(function (k) { original[k] = edits[k]; });
        update();
        msg.textContent = 'Saved ' + r.saved + '. Run `git diff` to see the change.';
      })
      .catch(function () { msg.textContent = 'Could not reach the editor server. Is edit.py still running?'; saveBtn.disabled = false; });
  }

  window.addEventListener('beforeunload', function (e) {
    if (Object.keys(changed()).length) { e.preventDefault(); e.returnValue = ''; }
  });
})();
