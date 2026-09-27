/* House face · collapsed saves · ★ only · localStorage · no $ */
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

  function bankToward(kidId) {
    try {
      if (global.WardKids && global.WardKids._data && global.WardKids.getBankView) {
        var b = global.WardKids.getBankView(kidId, global.WardKids._data);
        return b ? (b.lifetime || b.toward || 0) : 0;
      }
    } catch (e) { /* */ }
    return 0;
  }

  function chipHTML(item, kidId) {
    var toward = bankToward(kidId);
    var label;
    if (item.need > 0) {
      label = item.name + " · " + Math.min(toward, item.need) + "/" + item.need + " ★";
    } else {
      label = item.name + " · ★";
    }
    return (
      '<button type="button" class="save-pill" data-save-id="' + esc(item.id) + '" title="Tap to edit">' +
        '<span class="save-pill-label">' + esc(label) + "</span>" +
        '<span class="save-pill-x" data-save-del aria-label="Remove">×</span>' +
      "</button>"
    );
  }

  function setOpen(panel, open) {
    var form = panel.querySelector("[data-saves-form]");
    if (open) {
      panel.classList.add("is-open");
      panel.setAttribute("data-open", "1");
      if (form) form.hidden = false;
      var nameEl = panel.querySelector("[data-save-name]");
      if (nameEl) setTimeout(function () { nameEl.focus(); }, 30);
    } else {
      panel.classList.remove("is-open");
      panel.removeAttribute("data-open");
      if (form) form.hidden = true;
    }
  }

  function renderPanel(panel) {
    var kidId = panel.getAttribute("data-kid");
    if (!kidId) return;
    var items = list(kidId);
    var pills = panel.querySelector("[data-saves-pills]");
    if (pills) {
      if (!items.length) {
        pills.innerHTML = '<span class="save-pill empty">None yet</span>';
      } else {
        pills.innerHTML = items.map(function (it) { return chipHTML(it, kidId); }).join("");
      }
    }
    // legacy list node — keep empty / hidden
    var legacy = panel.querySelector("[data-saves-list]");
    if (legacy) legacy.innerHTML = "";
  }

  function renderList(kidId, root) {
    root = root || document;
    root.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"]').forEach(renderPanel);
    root.querySelectorAll('[data-saves-chips="' + kidId + '"]').forEach(function (el) {
      var items = list(kidId);
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
    renderPanel(panel);

    if (!panel._savesWired) {
      panel._savesWired = true;

      var plus = panel.querySelector("[data-saves-plus]");
      if (plus) {
        plus.addEventListener("click", function (e) {
          e.preventDefault();
          setOpen(panel, !panel.classList.contains("is-open"));
          if (window.HouseSfx) HouseSfx.tap();
        });
      }

      var cancel = panel.querySelector("[data-saves-cancel]");
      if (cancel) {
        cancel.addEventListener("click", function (e) {
          e.preventDefault();
          setOpen(panel, false);
        });
      }

      var form = panel.querySelector("[data-saves-form]");
      if (form) {
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
          setOpen(panel, false);
          renderAll(kidId);
          if (window.HouseSfx) HouseSfx.tap();
        });
      }

      panel.addEventListener("click", function (e) {
        var del = e.target.closest("[data-save-del]");
        var pill = e.target.closest(".save-pill[data-save-id]");
        if (del && pill) {
          e.preventDefault();
          e.stopPropagation();
          remove(kidId, pill.getAttribute("data-save-id"));
          renderAll(kidId);
          if (window.HouseSfx) HouseSfx.tap();
          return;
        }
        if (pill && !del) {
          var id = pill.getAttribute("data-save-id");
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

  function refreshGoalChips(kidId) {
    if (!global.WardKids || !global.WardKids.personalGoalView) return;
    try {
      var data = global.WardKids._data;
      if (!data) return;
      var bank = global.WardKids.getBankView ? global.WardKids.getBankView(kidId, data) : null;
      var gv = global.WardKids.personalGoalView(kidId, data, bank);
      document.querySelectorAll("[data-goal-chip]").forEach(function (el) {
        var scopeKid = el.getAttribute("data-kid")
          || (el.closest("[data-kid]") && el.closest("[data-kid]").getAttribute("data-kid"))
          || (el.closest("[data-bank-kid]") && el.closest("[data-bank-kid]").getAttribute("data-bank-kid"));
        if (scopeKid && scopeKid !== kidId) return;
        el.classList.remove("is-met", "is-active", "is-empty");
        if (!gv.active) {
          el.textContent = gv.placeholder || "Add a save";
          el.classList.add("is-empty");
        } else if (gv.met) {
          el.textContent = "Goal met · " + gv.name + " (" + gv.need + "★)";
          el.classList.add("is-met", "is-active");
        } else {
          el.textContent = gv.name + " · " + (gv.toward || 0) + "/" + gv.need + " ★";
          el.classList.add("is-active");
        }
      });
    } catch (e) { /* */ }
  }

  function renderAll(kidId) {
    document.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"]').forEach(wirePanel);
    renderList(kidId, document);
    refreshGoalChips(kidId);
  }

  function mount(kidId) {
    if (kidId) {
      list(kidId);
      document.querySelectorAll('[data-saves-panel][data-kid="' + kidId + '"]').forEach(wirePanel);
      renderList(kidId, document);
      refreshGoalChips(kidId);
    } else {
      document.querySelectorAll("[data-saves-panel][data-kid]").forEach(wirePanel);
    }
  }

  function panelHTML(kidId, opts) {
    opts = opts || {};
    var ph = opts.placeholder || "Saving for…";
    return (
      '<div class="saves-panel saves-compact" data-saves-panel data-kid="' + esc(kidId) + '">' +
        '<div class="saves-bar">' +
          '<span class="saves-lab">Saves</span>' +
          '<div class="saves-pills" data-saves-pills></div>' +
          '<button type="button" class="saves-plus" data-saves-plus aria-label="Add a save">+</button>' +
        "</div>" +
        '<form class="saves-form saves-drawer" data-saves-form autocomplete="off" hidden>' +
          '<input class="saves-input name" type="text" name="save-name" data-save-name maxlength="48" placeholder="' + esc(ph) + '" required />' +
          '<input class="saves-input need" type="number" name="save-need" data-save-need min="0" max="999" inputmode="numeric" placeholder="★" title="Optional ★ target" />' +
          '<button type="submit" class="saves-add-btn">Add</button>' +
          '<button type="button" class="saves-cancel" data-saves-cancel>✕</button>' +
        "</form>" +
        '<div class="saves-list" data-saves-list hidden></div>' +
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
