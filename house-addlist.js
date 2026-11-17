/* ADDLIST1 · Our Ideas + Groceries add buttons actually add (localStorage on this device). */
(function () {
  "use strict";
  var ls = window.localStorage;
  function get(k) { try { return JSON.parse(ls.getItem(k) || "[]") || []; } catch (e) { return []; } }
  function put(k, v) { try { ls.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ask(label, cb) {
    var old = document.querySelector(".wall-ask");
    if (old) old.remove();
    var ov = document.createElement("div");
    ov.className = "wall-ask";
    ov.setAttribute("data-no-idle", "1");
    ov.style.cssText = "position:fixed;inset:48px;z-index:2147483640;background:#101820;color:#f4efe6;border:1px solid rgba(224,195,106,.4);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:16px";
    ov.innerHTML = '<div style="font-size:32px;font-weight:800">' + esc(label) + '</div>' +
      '<input class="wall-ask-in" type="text" maxlength="80" style="font-size:28px;min-height:64px;padding:8px 16px;border-radius:12px;border:0">' +
      '<div class="wall-ask-keys" style="display:flex;flex-wrap:wrap;gap:8px"></div>' +
      '<div style="display:flex;gap:12px"><button type="button" class="wall-ask-ok" style="min-width:96px;min-height:64px;font-size:24px">Add</button>' +
      '<button type="button" class="wall-ask-x" style="min-width:96px;min-height:64px;font-size:24px">Close</button></div>';
    document.body.appendChild(ov);
    document.documentElement.setAttribute("data-no-idle", "1");
    var input = ov.querySelector(".wall-ask-in");
    var keys = ov.querySelector(".wall-ask-keys");
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ ".split("").forEach(function (ch) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = ch === " " ? "space" : ch;
      b.style.cssText = "min-width:64px;min-height:64px;font-size:24px";
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); input.value = (input.value + (ch === " " ? " " : ch)).slice(0, 80); });
      keys.appendChild(b);
    });
    function finish(v) {
      ov.remove();
      document.documentElement.removeAttribute("data-no-idle");
      cb(v == null ? "" : String(v).trim().slice(0, 80));
    }
    ov.querySelector(".wall-ask-x").addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); finish(""); });
    ov.querySelector(".wall-ask-ok").addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); finish(input.value); });
  }
  function on(el, fn) {
    if (!el || el.__addWired) return; el.__addWired = 1;
    el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.style.cursor = "pointer";
    el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(el); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(el); } });
  }
  var page = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");

  if (page === "sheet-weekend") {
    var K = "house-ideas:v1";
    var slots = [].slice.call(document.querySelectorAll(".opt.empty-slot"));
    var chips = [].slice.call(document.querySelectorAll(".vote-card"));
    var render = function () {
      var d = get(K); if (Array.isArray(d)) d = {}; d.ideas = d.ideas || []; d.kids = d.kids || {};
      var heldEmpty = false;
      slots.forEach(function (s, i) {
        var t = s.querySelector(".title"), sub = s.querySelector(".sub"), v = d.ideas[i];
        if (!v && heldEmpty) { s.hidden = true; return; }
        s.hidden = false;
        if (!v) {
          heldEmpty = true;
          t.textContent = "Ideas live here.";
          t.style.color = "";
          if (sub) sub.textContent = "Tap to add";
          s.setAttribute("aria-label", "Ideas live here.");
          return;
        }
        t.textContent = v; t.style.color = "";
        if (sub) sub.textContent = "Tap to change";
        s.setAttribute("aria-label", "Idea: " + v);
      });
      chips.forEach(function (c) {
        var kid = (c.querySelector(".q") || {}).textContent || "", a = c.querySelector(".a"), v = d.kids[kid];
        a.textContent = v || ""; a.style.color = v ? "" : "#8a8e96";
      });
      return d;
    };
    slots.forEach(function (s, i) { on(s, function () { ask("Idea " + (i + 1), function (v) { var d = render(); d.ideas[i] = v; put(K, d); render(); }); }); });
    chips.forEach(function (c) { on(c, function () { var kid = c.querySelector(".q").textContent; ask(kid + " idea", function (v) { var d = render(); d.kids[kid] = v; put(K, d); render(); }); }); });
    render();
  }

  if (page === "sheet-groceries") {
    var KF = "house-groc-favs:v1", KL = "house-groc-list:v1";
    var favWrap = document.querySelector(".fav-chips"), favAdd = document.querySelector(".fav.add"), favEmpty = document.querySelector(".favs-empty");
    var list = document.querySelector('section[aria-label="Home groceries"] .item-list'), addBtn = document.querySelector('section[aria-label="Home groceries"] .add-btn');
    var draw = function () {
      var favs = get(KF), items = get(KL);
      [].slice.call(favWrap.querySelectorAll(".fav:not(.add)")).forEach(function (n) { n.remove(); });
      favs.forEach(function (f) {
        var b = document.createElement("div"); b.className = "fav"; b.textContent = f; b.title = "Tap to add to list · hold to remove";
        on(b, function () { var it = get(KL); it.push({ n: f, d: false }); put(KL, it); draw(); });
        var x = document.createElement("button");
        x.type = "button"; x.textContent = "\u2715"; x.setAttribute("aria-label", "Remove");
        x.style.cssText = "min-width:64px;min-height:64px;margin-left:8px";
        x.hidden = true; b.appendChild(x);
        x.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          var left = get(KF).filter(function (n) { return n !== f; });
          put(KF, left);
          var toast = document.querySelector(".fav-undo");
          if (!toast) {
            toast = document.createElement("button");
            toast.type = "button"; toast.className = "fav-undo"; toast.style.cssText = "position:fixed;left:160px;bottom:64px;min-height:64px;min-width:160px;z-index:40;font-size:24px";
            document.body.appendChild(toast);
          }
          toast.textContent = "Undo";
          toast.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); var back = get(KF); if (back.indexOf(f) < 0) back.push(f); put(KF, back); toast.remove(); draw(); };
          draw();
        });
        favWrap.insertBefore(b, favAdd);
      });
      if (favEmpty) favEmpty.style.display = favs.length ? "none" : "";
      list.innerHTML = items.length ? "" : '<div class="list-empty">List is clear.</div>';
      items.forEach(function (it, i) {
        var r = document.createElement("div"); r.className = "groc-item" + (it.d ? " done" : "");
        r.style.cssText = "display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)";
        r.innerHTML = '<span class="ring" style="width:24px;height:24px;border-radius:50%;border:2px solid currentColor;display:inline-flex;align-items:center;justify-content:center">' + (it.d ? "✓" : "") + '</span><span style="flex:1;' + (it.d ? "text-decoration:line-through;opacity:.55" : "") + '">' + esc(it.n) + '</span><span class="groc-x" role="button" aria-label="Remove" style="padding:8px 12px;opacity:.6">✕</span>';
        on(r, function () { var a = get(KL); a[i].d = !a[i].d; put(KL, a); draw(); });
        on(r.querySelector(".groc-x"), function () { var a = get(KL); a.splice(i, 1); put(KL, a); draw(); });
        list.appendChild(r);
      });
    };
    if (favAdd && !favAdd.previousElementSibling || (favAdd && !document.querySelector(".fav-edit"))) {
      var edit = document.createElement("button");
      edit.type = "button"; edit.className = "fav-edit"; edit.textContent = "Edit";
      edit.style.cssText = "min-width:64px;min-height:64px;font-size:24px";
      edit.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        var on = edit.getAttribute("aria-pressed") === "true";
        edit.setAttribute("aria-pressed", on ? "false" : "true");
        [].slice.call(favWrap.querySelectorAll(".fav:not(.add) button")).forEach(function (b) { b.hidden = on; });
      });
      if (favAdd.parentNode) favAdd.parentNode.insertBefore(edit, favAdd);
    }
    on(favAdd, function () { ask("Add a favorite", function (v) { if (!v) return; var f = get(KF); if (f.indexOf(v) < 0) f.push(v); put(KF, f); draw(); }); });
    on(addBtn, function () { ask("Add to home groceries", function (v) { if (!v) return; var a = get(KL); a.push({ n: v, d: false }); put(KL, a); draw(); }); });
    draw();
  }
})();
