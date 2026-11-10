/*
 * Table view: fixed layout that always fits the available width, with
 * columns the user can make wider or narrower by dragging the right edge
 * of a column header. The title column takes the remaining space.
 *
 * Widths are remembered in localStorage; double-click a handle to reset
 * that column to its default width.
 */
(function () {
  var STORAGE_KEY = 'spotweb_table_cols';
  var FLEX_CLASS = 'title';   // column that absorbs the remaining width
  var MIN_FLEX = 120;         // title never gets narrower than this (px)
  var MIN_COL = 24;           // no other column gets narrower than this (px)

  var DEFAULTS = {
    category: 76, editspot: 26, watch: 26, comments: 36, genre: 100,
    poster: 100, date: 112, filesize: 68, nzb: 40, multinzb: 26, sabnzbd: 30
  };

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save(widths) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widths)); } catch (e) { /* ignore */ }
  }

  function colClass(th) {
    for (var cls in DEFAULTS) {
      if (th.classList.contains(cls)) { return cls; }
    }
    return th.classList.contains(FLEX_CLASS) ? FLEX_CLASS : null;
  }

  function init() {
    var table = qs('table.spots');
    var head = table && qs('tr.head', table);
    if (!head || table.dataset.resizable) { return; }
    table.dataset.resizable = '1';

    var ths = qsa('th', head);
    var stored = load();
    var colgroup = document.createElement('colgroup');
    var cols = [];

    ths.forEach(function (th) {
      var cls = colClass(th);
      var col = document.createElement('col');
      if (cls && cls !== FLEX_CLASS) {
        col.style.width = (stored[cls] || DEFAULTS[cls]) + 'px';
      }
      colgroup.appendChild(col);
      cols.push({ th: th, col: col, cls: cls });
    });

    table.insertBefore(colgroup, table.firstChild);
    table.classList.add('resizable');

    // The title column can only be resized by moving the border with its neighbour.
    cols.forEach(function (c, i) {
      if (!c.cls) { return; }
      var handle = document.createElement('span');
      handle.className = 'col-resizer';
      handle.title = 'Drag to resize, double-click to reset';
      c.th.appendChild(handle);

      handle.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });

      handle.addEventListener('dblclick', function (e) {
        e.preventDefault(); e.stopPropagation();
        var target = (c.cls === FLEX_CLASS) ? nextFixed(i) : c;
        if (!target) { return; }
        delete stored[target.cls];
        target.col.style.width = DEFAULTS[target.cls] + 'px';
        save(stored);
      });

      handle.addEventListener('mousedown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var isFlex = (c.cls === FLEX_CLASS);
        var target = isFlex ? nextFixed(i) : c;
        if (!target) { return; }

        var startX = e.clientX;
        var startW = target.th.getBoundingClientRect().width;
        var flexW = cols.filter(function (x) { return x.cls === FLEX_CLASS; })[0].th.getBoundingClientRect().width;
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
          stored[target.cls] = Math.round(target.th.getBoundingClientRect().width);
          save(stored);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });

    // first resizable (non-title) column right of the title
    function nextFixed(i) {
      for (var j = i + 1; j < cols.length; j++) {
        if (cols[j].cls && cols[j].cls !== FLEX_CLASS) { return cols[j]; }
      }
      return null;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
