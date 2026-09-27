/* House face · kid save/wishlist write-in · ★ only · localStorage · no $ */
(function (global) {
  "use strict";

  var KEY = "house-saves:v1";
  var DEFAULTS = {
    ainsley: [{ id: "seed-stick-season", name: "Stick Season · concert save", need: 40, locked: false }]
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadRoot() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveRoot(root) {
    try { localStorage.setItem(KEY, JSON.stringify(root)); } catch (e) { /* */ }
  }

  function list(kidId) {
    var root = loadRoot();
    if (!root[kidId]) {
      root[kidId] = (DEFAULTS[kidId] || []).map(function (x) {
        return { id: x.id, name: x.name, need: x.need || 0, created: Date.now() };
      });
      saveRoot(root);
    }
    return root[kidId].slice();
  }

  function uid() {
    return "save-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function add(kidId, name, need) {
    name = String(name || "").trim();
    if (!name) return null;
    need = parseInt(need, 10);
    if (isNaN(need) || need < 0) need = 0;
    var root = loadRoot();
    if (!root[kidId]) root[kidId] = list(kidId);
    var item = { id: uid(), name: name, need: need, created: Date.now() };
    root[kidId].push(item);
    saveRoot(root);
    return item;
  }

  function update(kidId, id, name, need) {
    var root = loadRoot();
    var arr = root[kidId] || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        if (name != null) arr[i].name = String(name).trim() || arr[i].name;
        if (need != null) {
          var n = parseInt(need, 10);
          arr[i].need = isNaN(n) || n < 0 ? 0 : n;
        }
        saveRoot(root);
        return arr[i];
      }
    }
    return null;
  }

  function remove(kidId, id) {
    var root = loadRoot();
    var arr = root[kidId] || [];
    root[kidId] = arr.filter(function (x) { return x.id !== id; });
    saveRoot(root);
  }

  function rowHTML(item) {
    var need = item.need > 0 ? (" · " + item.need + "★") : "";
    return (
      '<div class="save-row" data-save-id="' + esc(item.id) + '">' +
        '<div class="save-main">' +
          '<span class="save-name">' + esc(item.name) + "</span>" +
          '<span class="save-need">' + esc(need || " · ★ later") + "</span>" +
        "</div>" +
        '<div class="save-actions">' +
          '<button type="button" class="save-btn edit" data-save-edit title="Edit">Edit</button>' +
          '<button type="button" class="save-btn del" data-save-del title="Remove">✕</button>' +
        "</div>" +
      "</div>"
    );
  }

  function renderList(kidId, root) {
    root = root || document;
    var lists = root.querySelectorAll('[data-saves-list="' + kidId + '"], [data-saves-list][data-kid="' + kidId + '"]');
    // also [data-saves-panel][data-kid=x] .saves-list
    if (!lists.length) {
      root.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"] [data-saves-list]').forEach(function (el) {
        lists = lists.length ? lists : [];
      });
      lists = root.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"] [data-saves-list]');
    }
    var items = list(kidId);
    lists.forEach(function (el) {
      if (!items.length) {
        el.innerHTML = '<div class="save-empty">Nothing yet — add what you\'re saving for</div>';
      } else {
        el.innerHTML = items.map(rowHTML).join("");
      }
    });
    // compact chips elsewhere
    root.querySelectorAll('[data-saves-chips="' + kidId + '"]').forEach(function (el) {
      if (!items.length) {
        el.innerHTML = '<span class="save-chip empty">No saves yet</span>';
      } else {
        el.innerHTML = items.map(function (it) {
          var n = it.need > 0 ? (" " + it.need + "★") : "";
          return '<span class="save-chip">' + esc(it.name) + esc(n) + "</span>";
        }).join("");
      }
    });
  }

  function wirePanel(panel) {
    var kidId = panel.getAttribute("data-kid");
    if (!kidId) return;
    renderList(kidId, panel.parentNode || document);

    var form = panel.querySelector("[data-saves-form]");
    if (form && !form._savesWired) {
      form._savesWired = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var nameEl = form.querySelector("[name='save-name'], [data-save-name]");
        var needEl = form.querySelector("[name='save-need'], [data-save-need]");
        var name = nameEl ? nameEl.value : "";
        var need = needEl ? needEl.value : 0;
        if (!String(name).trim()) {
          if (nameEl) nameEl.focus();
          return;
        }
        add(kidId, name, need);
        if (nameEl) nameEl.value = "";
        if (needEl) needEl.value = "";
        renderAll(kidId);
        if (window.HouseSfx) HouseSfx.tap();
        if (nameEl) nameEl.focus();
      });
    }

    if (!panel._savesClickWired) {
      panel._savesClickWired = true;
      panel.addEventListener("click", function (e) {
        var del = e.target.closest("[data-save-del]");
        var edit = e.target.closest("[data-save-edit]");
        var row = e.target.closest(".save-row");
        if (!row) return;
        var id = row.getAttribute("data-save-id");
        if (del) {
          remove(kidId, id);
          renderAll(kidId);
          if (window.HouseSfx) HouseSfx.tap();
          return;
        }
        if (edit) {
          var items = list(kidId);
          var cur = null;
          for (var i = 0; i < items.length; i++) if (items[i].id === id) cur = items[i];
          if (!cur) return;
          var nn = window.prompt("Save name", cur.name);
          if (nn == null) return;
          var nd = window.prompt("★ target (blank = none)", cur.need ? String(cur.need) : "");
          if (nd == null) return;
          update(kidId, id, nn, nd === "" ? 0 : nd);
          renderAll(kidId);
          if (window.HouseSfx) HouseSfx.tap();
        }
      });
    }
  }

  function renderAll(kidId) {
    document.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"]').forEach(wirePanel);
    renderList(kidId, document);
  }

  function mount(kidId) {
    if (kidId) {
      // ensure seed
      list(kidId);
      document.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"]').forEach(wirePanel);
      renderList(kidId, document);
    } else {
      document.querySelectorAll("[data-saves-panel][data-kid]").forEach(function (p) {
        wirePanel(p);
      });
    }
  }

  function panelHTML(kidId, opts) {
    opts = opts || {};
    var title = opts.title || "Saving for";
    var ph = opts.placeholder || "What are you saving for?";
    return (
      '<div class="saves-panel" data-saves-panel data-kid="' + esc(kidId) + '">' +
        '<div class="saves-hdr"><span class="saves-title">' + esc(title) + '</span>' +
        '<span class="saves-hint">write it in · ★ only</span></div>' +
        '<div class="saves-list" data-saves-list></div>' +
        '<form class="saves-form" data-saves-form autocomplete="off">' +
          '<input class="saves-input name" type="text" name="save-name" data-save-name maxlength="48" placeholder="' + esc(ph) + '" required />' +
          '<input class="saves-input need" type="number" name="save-need" data-save-need min="0" max="999" inputmode="numeric" placeholder="★" title="Optional ★ target" />' +
          '<button type="submit" class="saves-add-btn">+ Add a save</button>' +
        "</form>" +
      "</div>"
    );
  }

  global.HouseSaves = {
    KEY: KEY,
    list: list,
    add: add,
    update: update,
    remove: remove,
    mount: mount,
    renderAll: renderAll,
    panelHTML: panelHTML
  };
})(window);
