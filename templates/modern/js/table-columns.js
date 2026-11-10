/*
 * Table view: fixed layout that always fits the available width, with
 * columns the user can
 *   - make wider or narrower by dragging the right edge of a column header
 *   - reorder by dragging a column header onto another one.
 * The title column takes the remaining space.
 *
 * Widths and order are remembered in localStorage; double-click a resize
 * handle to reset that column to its default width.
 */
(function () {
  var WIDTH_KEY = 'spotweb_table_cols';
  var ORDER_KEY = 'spotweb_table_order';
  var FLEX_CLASS = 'title';   // column that absorbs the remaining width
  var MIN_FLEX = 120;         // title never gets narrower than this (px)
  var MIN_COL = 24;           // no other column gets narrower than this (px)

  var DEFAULTS = {
    category: 76, editspot: 26, watch: 26, comments: 36, genre: 100,
    poster: 100, date: 112, filesize: 68, nzb: 40, multinzb: 26, sabnzbd: 30
  };

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  // Column key of a header or body cell: the first known class it carries.
  function cellKey(el) {
    if (el.classList.contains(FLEX_CLASS)) { return FLEX_CLASS; }
    for (var cls in DEFAULTS) {
      if (el.classList.contains(cls)) { return cls; }
    }
    return null;
  }

  function init() {
    var table = qs('table.spots');
    var head = table && qs('tr.head', table);
    if (!head || table.dataset.resizable) { return; }
    table.dataset.resizable = '1';

    var storedWidths = loadJson(WIDTH_KEY, {});
    var colgroup = document.createElement('colgroup');
    var cols = [];   // { th, col, key } in current display order

    qsa('th', head).forEach(function (th) {
      var key = cellKey(th);
      var col = document.createElement('col');
      if (key && key !== FLEX_CLASS) {
        col.style.width = (storedWidths[key] || DEFAULTS[key]) + 'px';
      }
      colgroup.appendChild(col);
      cols.push({ th: th, col: col, key: key });
    });

    table.insertBefore(colgroup, table.firstChild);
    table.classList.add('resizable');

    // ---------- column order ----------

    // Put the cells of one row in the current column order.
    function orderRow(tr) {
      if (tr.classList.contains('noresults')) { return; }
      var cells = {};
      var children = Array.prototype.slice.call(tr.children);
      for (var i = 0; i < children.length; i++) {
        var key = cellKey(children[i]);
        if (!key) { return; }   // unknown layout: leave this row alone
        cells[key] = children[i];
      }
      cols.forEach(function (c) {
        if (cells[c.key]) { tr.appendChild(cells[c.key]); }
      });
    }

    function applyOrder() {
      cols.forEach(function (c) {
        colgroup.appendChild(c.col);
        head.appendChild(c.th);
      });
      qsa('tbody#spots tr', table).forEach(orderRow);
    }

    // Restore the saved order; columns that are not in it keep their relative position.
    (function restoreOrder() {
      var saved = loadJson(ORDER_KEY, []);
      if (!saved.length) { return; }
      var rank = {};
      saved.forEach(function (k, i) { rank[k] = i; });
      var indexed = cols.map(function (c, i) { return { c: c, i: i }; });
      indexed.sort(function (a, b) {
        var ra = (a.c.key in rank) ? rank[a.c.key] : 1000 + a.i;
        var rb = (b.c.key in rank) ? rank[b.c.key] : 1000 + b.i;
        return ra - rb;
      });
      cols = indexed.map(function (x) { return x.c; });
      applyOrder();
    })();

    // Rows added later (infinite scroll / "Load more") follow the same order.
    var tbody = qs('tbody#spots', table);
    if (tbody && window.MutationObserver) {
      new MutationObserver(function (records) {
        records.forEach(function (r) {
          Array.prototype.forEach.call(r.addedNodes, function (n) {
            if (n.nodeType === 1 && n.tagName === 'TR') { orderRow(n); }
          });
        });
      }).observe(tbody, { childList: true });
    }

    function moveColumn(fromKey, toKey, after) {
      var from = null;
      cols.forEach(function (c) { if (c.key === fromKey) { from = c; } });
      if (!from || fromKey === toKey) { return; }
      cols = cols.filter(function (c) { return c !== from; });
      var at = 0;
      cols.forEach(function (c, i) { if (c.key === toKey) { at = i + (after ? 1 : 0); } });
      cols.splice(at, 0, from);
      applyOrder();
      saveJson(ORDER_KEY, cols.map(function (c) { return c.key; }));
    }

    var dragKey = null;

    function clearDropMarks() {
      cols.forEach(function (c) { c.th.classList.remove('col-drop-before', 'col-drop-after'); });
    }

    // ---------- headers: drag to reorder, handle to resize ----------

    function nextFixed(c) {
      for (var j = cols.indexOf(c) + 1; j < cols.length; j++) {
        if (cols[j].key && cols[j].key !== FLEX_CLASS) { return cols[j]; }
      }
      return null;
    }

    cols.forEach(function (c) {
      if (!c.key) { return; }

      c.th.draggable = true;
      qsa('a', c.th).forEach(function (a) { a.draggable = false; });

      c.th.addEventListener('dragstart', function (e) {
        dragKey = c.key;
        c.th.classList.add('col-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', c.key); } catch (err) { /* IE */ }
        }
      });
      c.th.addEventListener('dragend', function () {
        dragKey = null;
        c.th.classList.remove('col-dragging');
        clearDropMarks();
      });
      c.th.addEventListener('dragover', function (e) {
        if (!dragKey || dragKey === c.key) { return; }
        e.preventDefault();
        var r = c.th.getBoundingClientRect();
        var after = e.clientX > r.left + r.width / 2;
        clearDropMarks();
        c.th.classList.add(after ? 'col-drop-after' : 'col-drop-before');
      });
      c.th.addEventListener('dragleave', function () {
        c.th.classList.remove('col-drop-before', 'col-drop-after');
      });
      c.th.addEventListener('drop', function (e) {
        if (!dragKey) { return; }
        e.preventDefault();
        var r = c.th.getBoundingClientRect();
        var after = e.clientX > r.left + r.width / 2;
        clearDropMarks();
        moveColumn(dragKey, c.key, after);
        dragKey = null;
      });

      // The resize handle: the title can only be resized by moving the border with its neighbour.
      var handle = document.createElement('span');
      handle.className = 'col-resizer';
      handle.title = 'Drag to resize, double-click to reset';
      handle.draggable = false;
      c.th.appendChild(handle);

      // A drag that starts on the handle must resize, not move the column.
      handle.addEventListener('mouseenter', function () { c.th.draggable = false; });
      handle.addEventListener('mouseleave', function () { c.th.draggable = true; });

      handle.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });

      handle.addEventListener('dblclick', function (e) {
        e.preventDefault(); e.stopPropagation();
        var target = (c.key === FLEX_CLASS) ? nextFixed(c) : c;
        if (!target) { return; }
        delete storedWidths[target.key];
        target.col.style.width = DEFAULTS[target.key] + 'px';
        saveJson(WIDTH_KEY, storedWidths);
      });

      handle.addEventListener('mousedown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var isFlex = (c.key === FLEX_CLASS);
        var target = isFlex ? nextFixed(c) : c;
        if (!target) { return; }

        var startX = e.clientX;
        var startW = target.th.getBoundingClientRect().width;
        var flexW = cols.filter(function (x) { return x.key === FLEX_CLASS; })[0].th.getBoundingClientRect().width;
        document.body.classList.add('col-resizing');

        function move(ev) {
          var dx = ev.clientX - startX;
          // Dragging the title border to the right shrinks the next column and vice versa.
          var w = startW + (isFlex ? -dx : dx);
          // The title column has to keep a usable width.
          var maxW = startW + Math.max(0, flexW - MIN_FLEX);
          w = Math.max(MIN_COL, Math.min(w, maxW));
          target.col.style.width = Math.round(w) + 'px';
        }
        function up() {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          document.body.classList.remove('col-resizing');
          storedWidths[target.key] = Math.round(target.th.getBoundingClientRect().width);
          saveJson(WIDTH_KEY, storedWidths);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
