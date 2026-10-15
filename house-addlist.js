/* ADDLIST1 · Our Ideas + Groceries add buttons actually add (localStorage on this device). */
(function () {
  "use strict";
  var ls = window.localStorage;
  function get(k) { try { return JSON.parse(ls.getItem(k) || "[]") || []; } catch (e) { return []; } }
  function put(k, v) { try { ls.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ask(label) { var v = window.prompt(label, ""); v = v == null ? "" : String(v).trim().slice(0, 80); return v; }
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
      slots.forEach(function (s, i) {
        var t = s.querySelector(".title"), sub = s.querySelector(".sub"), v = d.ideas[i];
        t.textContent = v || "Tap to add an idea"; t.style.color = v ? "" : "#8a8e96";
        if (sub) sub.textContent = v ? "Tap to change" : "Empty brainstorm";
        s.setAttribute("aria-label", v ? "Idea: " + v : "Tap to add an idea");
      });
      chips.forEach(function (c) {
        var kid = (c.querySelector(".q") || {}).textContent || "", a = c.querySelector(".a"), v = d.kids[kid];
        a.textContent = v || "Tap to add an idea"; a.style.color = v ? "" : "#8a8e96";
      });
      return d;
    };
    slots.forEach(function (s, i) { on(s, function () { var d = render(), v = ask("Idea " + (i + 1) + " (blank clears)"); d.ideas[i] = v; put(K, d); render(); }); });
    chips.forEach(function (c) { on(c, function () { var d = render(), kid = c.querySelector(".q").textContent, v = ask(kid + "'s idea (blank clears)"); d.kids[kid] = v; put(K, d); render(); }); });
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
        b.addEventListener("contextmenu", function (e) { e.preventDefault(); put(KF, get(KF).filter(function (x) { return x !== f; })); draw(); });
        favWrap.insertBefore(b, favAdd);
      });
      if (favEmpty) favEmpty.style.display = favs.length ? "none" : "";
      list.innerHTML = items.length ? "" : '<div class="list-empty">List empty · tap + add</div>';
      items.forEach(function (it, i) {
        var r = document.createElement("div"); r.className = "groc-item" + (it.d ? " done" : "");
        r.style.cssText = "display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)";
        r.innerHTML = '<span class="ring" style="width:24px;height:24px;border-radius:50%;border:2px solid currentColor;display:inline-flex;align-items:center;justify-content:center">' + (it.d ? "✓" : "") + '</span><span style="flex:1;' + (it.d ? "text-decoration:line-through;opacity:.55" : "") + '">' + esc(it.n) + '</span><span class="groc-x" role="button" aria-label="Remove" style="padding:8px 12px;opacity:.6">✕</span>';
        on(r, function () { var a = get(KL); a[i].d = !a[i].d; put(KL, a); draw(); });
        on(r.querySelector(".groc-x"), function () { var a = get(KL); a.splice(i, 1); put(KL, a); draw(); });
        list.appendChild(r);
      });
    };
    on(favAdd, function () { var v = ask("Add a favorite"); if (!v) return; var f = get(KF); if (f.indexOf(v) < 0) f.push(v); put(KF, f); draw(); });
    on(addBtn, function () { var v = ask("Add to home groceries"); if (!v) return; var a = get(KL); a.push({ n: v, d: false }); put(KL, a); draw(); });
    draw();
  }
})();
