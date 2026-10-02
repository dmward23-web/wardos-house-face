/* LANDFILL1 · House Face boards · landscape fill (Dan, Oct 1 9:3x PM CT: "the board is LANDSCAPE"; his Chrome
   on a ~1024x576 laptop window showed the hub as a narrow portrait column with black on both sides).
   On a landscape window (>= 960 wide, >= 1.25x wider than tall, not a phone screen) the board's .panel is drawn
   at a fluid type scale z = clamp(0.8, width / 1600, 1.6) and sized to the WHOLE viewport at that scale; its
   sections flow into as many columns as fit (CSS columns, about 500 design px each). Long lists scroll down the
   page; nothing is a fixed-width center column. Portrait (the 1080x1920 wall, phones) is untouched.
   Pure layout: no data, no writes, no network. Linked in <head> (sets html[data-landscape] before first paint). */
(function (g) {
  "use strict";
  var BASIS = 1600, ZMIN = 0.8, ZMAX = 1.6, COLW = 500;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function phone() { try { return Math.min(screen.width, screen.height) <= 600; } catch (e) { return false; } }
  function width() { return document.documentElement.clientWidth || g.innerWidth || 0; }
  function isLandscape() { var w = g.innerWidth || width(), h = g.innerHeight || 1; return w >= 960 && w >= h * 1.25 && !phone(); }
  function sections(panel) {
    return Array.prototype.filter.call(panel.children, function (e) {
      if (e.hasAttribute("hidden") || e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.tagName === "TEMPLATE") return false;
      if (e.hasAttribute("data-ls-span")) return false;
      var cs = g.getComputedStyle(e); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  function apply() {
    var root = document.documentElement, on = isLandscape();
    if (on) root.setAttribute("data-landscape", ""); else root.removeAttribute("data-landscape");
    var panel = document.querySelector(".panel"); if (!panel) return;
    if (!on) { if (panel.hasAttribute("data-ls-zoom")) { panel.style.zoom = ""; panel.removeAttribute("data-ls-zoom"); } unpack(panel); root.removeAttribute("data-ls-pack"); return; }
    var w = width(), h = g.innerHeight || 1, z = clamp(w / BASIS, ZMIN, ZMAX);
    ["transform", "transform-origin", "margin-left", "margin-top", "margin-bottom"].forEach(function (p) { panel.style.removeProperty(p); });
    document.body.style.removeProperty("height");
    root.removeAttribute("data-ls-row");
    if (!panel.hasAttribute("data-ls-grid")) { unpack(panel); root.setAttribute("data-ls-pack", ""); }
    setZoom(panel, root, w, h, z);
    flatten(panel, h / z);
    var n = flow(panel).length;
    if (panel.hasAttribute("data-ls-grid")) { root.removeAttribute("data-ls-pack"); setCols(panel, root, colsFor(panel, w, z, n)); return; }
    pack(panel, root, w, h, z);
    sig = sign();
  }
  function setZoom(panel, root, w, h, z) {
    panel.style.zoom = String(z); panel.setAttribute("data-ls-zoom", String(Math.round(z * 1000) / 1000));
    root.style.setProperty("--ls-z", String(z));
    root.style.setProperty("--ls-w", (w / z).toFixed(2) + "px");
    root.style.setProperty("--ls-h", (h / z).toFixed(2) + "px");
  }
  function colsFor(panel, w, z, n) {
    var cols = clamp(Math.floor((w / z) / COLW), 1, Math.max(1, n));
    var force = parseInt(panel.getAttribute("data-ls-cols") || "", 10); if (force > 0) cols = Math.min(cols, force);
    return cols;
  }
  function setCols(panel, root, cols) { root.style.setProperty("--ls-cols", String(cols)); root.setAttribute("data-ls-cols", String(cols)); }
  /* LANDFILL2 (Atlas 10/2: "multi-column at full width", every board's first screen full, scroll ends at the last
     content). The board is a grid of N full-height columns: sections are dealt masonry-style (each to the shortest
     column, in reading order), the type scale grows (up to FITMAX x the base) while everything still fits one screen,
     and each column's cards share out what is left of the window height so no column ends in a black band.
     A board longer than the window keeps the base scale and scrolls; its columns are evened to the tallest one. */
  var ROW = 2, GAP = 12, FITMAX = 1.7, ZFIT = 2.6;
  var PLACED = "data-ls-placed";
  function unpack(panel, keepWide) {
    if (!keepWide) Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-autowide]"), function (e) { e.removeAttribute("data-ls-autowide"); });
    Array.prototype.forEach.call(panel.querySelectorAll("[" + PLACED + "]"), function (e) {
      e.style.removeProperty("grid-row"); e.style.removeProperty("grid-column"); e.removeAttribute(PLACED);
    });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-zoomed]"), function (e) { e.style.zoom = ""; e.removeAttribute("data-ls-zoomed"); });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-fill],[data-ls-grow],[data-ls-end],[data-ls-foot]"), function (e) { ["data-ls-fill", "data-ls-grow", "data-ls-end", "data-ls-foot"].forEach(function (a) { e.removeAttribute(a); }); });
  }
  /* a card that got taller shares the height out inside: its own boxes (chips, rows, tiles) grow with their
     content centred, plain text keeps its size, and what is left goes evenly between the rows. A card that
     brings its own grid or row layout keeps it (its rows already stretch). */
  function boxy(cs) {
    var bg = cs.backgroundColor, img = cs.backgroundImage;
    return (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") || (img && img !== "none") || (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderBottomWidth) > 0);
  }
  function kidsOf(e) {
    return Array.prototype.filter.call(e.children, function (k) {
      if (k.hasAttribute("hidden") || /^(SCRIPT|STYLE|TEMPLATE)$/.test(k.tagName)) return false;
      var cs = g.getComputedStyle(k); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  function fill(e, depth) {
    var cs = g.getComputedStyle(e), d = cs.display;
    var col = /flex/.test(d) && cs.flexDirection.indexOf("column") === 0;
    if (!(d === "block" || d === "flow-root" || col)) return;
    var kids = kidsOf(e); if (!kids.length) return;
    e.setAttribute("data-ls-fill", "");
    kids.forEach(function (k) {
      var kc = g.getComputedStyle(k), r = k.getBoundingClientRect();
      if (boxy(kc) && r.height > 24 && r.width > 80) k.setAttribute("data-ls-grow", /grid/.test(kc.display) ? "grid" : /flex/.test(kc.display) ? (kc.flexDirection.indexOf("column") === 0 ? "col" : "row") : "block");
      else if (depth < 3 && kidsOf(k).length >= 2 && r.height > 48) { k.setAttribute("data-ls-grow", "wrap"); fill(k, depth + 1); }
    });
  }
  function place(e, row, col) { e.style.setProperty("grid-row", row, "important"); e.style.setProperty("grid-column", col, "important"); e.setAttribute(PLACED, ""); }
  /* do a card's words (and images / controls) still sit inside it, none cut off? */
  function fitsIn(e) {
    var r0 = e.getBoundingClientRect(), ok = true, tw = document.createTreeWalker(e, 4, null), n, rg = document.createRange();
    var boxes = [];
    while (ok && (n = tw.nextNode())) {
      if (!n.nodeValue.trim() || !n.parentElement || g.getComputedStyle(n.parentElement).visibility === "hidden") continue;
      rg.selectNodeContents(n); var rs = rg.getClientRects();
      for (var i = 0; i < rs.length; i++) {
        if (rs[i].width <= 0) continue;
        if (rs[i].bottom > r0.bottom + 1 || rs[i].right > r0.right + 1 || rs[i].top < r0.top - 1) { ok = false; break; }
        if (boxes.length < 160) boxes.push(rs[i]);
      }
    }
    if (!ok) return false;
    /* no two lines of words drawn over each other */
    for (var a = 0; a < boxes.length; a++) for (var b = a + 1; b < boxes.length; b++) {
      var A = boxes[a], B = boxes[b], ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ix > 2 && iy > 2 && ix * iy > 0.25 * Math.min(A.width * A.height, B.width * B.height)) return false;
    }
    var all = e.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      var k = all[j]; if (k.scrollWidth > k.clientWidth + 1 && k.clientWidth > 0) { var cs = g.getComputedStyle(k); if (cs.overflowX !== "visible" || cs.textOverflow === "ellipsis") return false; }
      if (/^(IMG|SVG|BUTTON|INPUT|CANVAS)$/i.test(k.tagName)) { var rk = k.getBoundingClientRect(); if (rk.bottom > r0.bottom + 1 || rk.right > r0.right + 1) return false; }
    }
    return true;
  }
  function hpx(e, z) { return e.getBoundingClientRect().height / z; }
  function leads(panel) { /* header, .hdr, [data-ls-lead], [data-ls-span]: direct children, in board order */
    return Array.prototype.filter.call(panel.children, function (e) {
      if (!e.matches(LEAD) || e.hasAttribute("hidden")) return false;
      var cs = g.getComputedStyle(e); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  function foots(panel) {
    /* an empty footer strip (no words, nothing in it) is not drawn in landscape: it would only be a black band */
    return Array.prototype.filter.call(panel.children, function (e) {
      if (!e.matches("footer, .ftr") || e.hasAttribute("hidden")) return false;
      var empty = !e.textContent.trim() && !e.querySelector("img, svg, button, a, input, canvas");
      if (empty) e.setAttribute("data-ls-skip", ""); else e.removeAttribute("data-ls-skip");
      if (empty) return false;
      var cs = g.getComputedStyle(e); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  /* lay out at scale z; returns the fit (columns, spans) without the final stretch */
  /* lay out at scale z (measure pass): the board's header and lead sections are dealt like any card (a header in
     one column has no empty middle); [data-ls-wide] (or a card taller than the window that is itself a grid of
     tiles: the month, the photo wall) runs across every column and starts a new block; a block with fewer cards
     than columns shares the width out among them; the footer strip runs across the bottom. The grid has T thin
     tracks so a block of 1 to 6 columns always divides it evenly. */
  var T = 60;
  function wideOf(e) { return e.hasAttribute("data-ls-wide") || e.hasAttribute("data-ls-autowide"); }
  function gridish(e) {
    var w = e.getBoundingClientRect().width, q = [e], d = 0;
    while (q.length && d < 4) {
      var nx = [];
      for (var i = 0; i < q.length; i++) {
        var cs = g.getComputedStyle(q[i]), r = q[i].getBoundingClientRect();
        if (r.width >= w * 0.8 && ((/grid/.test(cs.display) && cs.gridTemplateColumns.split(" ").length >= 2) || (/flex/.test(cs.display) && cs.flexWrap === "wrap" && cs.flexDirection.indexOf("row") === 0))) return true;
        Array.prototype.push.apply(nx, kidsOf(q[i]));
      }
      q = nx; d++;
    }
    return false;
  }
  function blocks(all, cols) {
    var segs = [], cur = null;
    all.forEach(function (e, i) {
      if (wideOf(e)) { segs.push({ wide: i }); cur = null; return; }
      if (!cur) { cur = { list: [] }; segs.push(cur); }
      cur.list.push(i);
    });
    segs.forEach(function (sg) { if (sg.list) sg.k = Math.min(cols, sg.list.length); });
    return segs;
  }
  function measure(panel, root, all, ft, segs, z) {
    root.setAttribute("data-ls-measure", "");
    unpack(panel, true);
    ft.forEach(function (e) { place(e, "auto", "1 / -1"); });
    segs.forEach(function (sg) {
      if (!sg.list) place(all[sg.wide], "auto", "1 / -1");
      else sg.list.forEach(function (i) { place(all[i], "auto", "1 / span " + (T / sg.k)); });
    });
    var hs = all.map(function (e) { return hpx(e, z); });
    root.removeAttribute("data-ls-measure");
    return hs;
  }
  /* deal a block's cards into its k columns so the tallest column is as short as it can be (every split is tried
     for a small board; a big one goes largest-first into the shortest column). The first card (the header) stays
     top-left; inside a column the cards keep board order. */
  function deal(sg, hs, all) {
    /* a bare label (a list's heading lifted out with its wrapper) rides with the card under it */
    var groups = [], pend = [];
    sg.list.forEach(function (i) {
      var e = all[i], lab = !boxy(g.getComputedStyle(e)) && hs[i] < 48 && !e.matches(LEAD);
      pend.push(i); if (!lab) { groups.push(pend); pend = []; }
    });
    if (pend.length) { if (groups.length) Array.prototype.push.apply(groups[groups.length - 1], pend); else groups.push(pend); }
    var n = groups.length, k = Math.min(sg.k, n); sg.k = k;
    var hh = groups.map(function (gr) { return gr.reduce(function (a, i) { return a + hs[i] + GAP; }, 0); }), asg = null;
    if (Math.pow(k, n - 1) <= 6561) {
      var best = Infinity, spread = Infinity, cur = new Array(n), tot = new Array(k);
      for (var code = 0, lim = Math.pow(k, n - 1); code < lim; code++) {
        var x = code; cur[0] = 0;
        for (var j = 1; j < n; j++) { cur[j] = x % k; x = Math.floor(x / k); }
        for (var c = 0; c < k; c++) tot[c] = 0;
        for (j = 0; j < n; j++) tot[cur[j]] += hh[j];
        var mx = Math.max.apply(null, tot), mn = Math.min.apply(null, tot);
        if (mn <= 0) continue;
        if (mx < best - 0.5 || (Math.abs(mx - best) <= 0.5 && mx - mn < spread)) { best = mx; spread = mx - mn; asg = cur.slice(); }
      }
    }
    if (!asg) {
      asg = new Array(n); var t2 = []; for (var c2 = 0; c2 < k; c2++) t2.push(0);
      var ord = hh.map(function (v, j) { return j; }).sort(function (a, b) { return hh[b] - hh[a]; });
      ord.forEach(function (j) { var m = 0; for (var c3 = 1; c3 < k; c3++) if (t2[c3] < t2[m]) m = c3; asg[j] = m; t2[m] += hh[j]; });
    }
    sg.col = []; sg.tot = []; for (var c4 = 0; c4 < k; c4++) { sg.col.push([]); sg.tot.push(0); }
    for (var j2 = 0; j2 < n; j2++) { Array.prototype.push.apply(sg.col[asg[j2]], groups[j2]); sg.tot[asg[j2]] += hh[j2]; }
  }
  /* how much spare height a card takes: a header none, a card with many rows / tiles more (it spreads it thin) */
  function weight(e) {
    if (e.matches(LEAD) && !e.matches(".hot-banner")) return 0;
    if (!boxy(g.getComputedStyle(e)) && e.getBoundingClientRect().height / (parseFloat(e.closest(".panel").style.zoom) || 1) < 48) return 0;
    var n = 0, q = kidsOf(e), d = 0;
    while (q.length && d < 3 && n < 20) {
      var nx = [];
      q.forEach(function (k) { var cs = g.getComputedStyle(k); if (boxy(cs) && k.getBoundingClientRect().height > 24) n++; else Array.prototype.push.apply(nx, kidsOf(k)); });
      q = nx; d++;
    }
    return 1 + Math.min(20, n);
  }
  function trial(panel, root, w, h, z) {
    setZoom(panel, root, w, h, z);
    var ft = foots(panel);
    var all = leads(panel).concat(flow(panel)).filter(function (e) { return !e.matches("footer, .ftr"); });
    all.forEach(function (e) { e.removeAttribute("data-ls-autowide"); });
    var cols = colsFor(panel, w, z, all.length); setCols(panel, root, cols);
    var pcs = g.getComputedStyle(panel), pad = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce(function (a, k) { return a + (parseFloat(pcs[k]) || 0); }, 0);
    var segs = blocks(all, cols), hs = measure(panel, root, all, ft, segs, z), again = false;
    if (cols > 1) all.forEach(function (e, i) { if (!wideOf(e) && !e.matches(LEAD) && hs[i] > 1.5 * (h / z - pad) && gridish(e)) { e.setAttribute("data-ls-autowide", ""); again = true; } });
    if (again) { segs = blocks(all, cols); hs = measure(panel, root, all, ft, segs, z); }
    var fh = [], total = 0;
    root.setAttribute("data-ls-measure", ""); fh = ft.map(function (e) { return hpx(e, z); }); root.removeAttribute("data-ls-measure");
    segs.forEach(function (sg) {
      if (!sg.list) { sg.max = hs[sg.wide] + GAP; total += sg.max; return; }
      deal(sg, hs, all);
      sg.max = Math.max.apply(null, sg.tot); total += sg.max;
    });
    var bot = 0; fh.forEach(function (v) { bot += Math.ceil((v + 4) / ROW) * ROW; });
    var avail = h / z - pad - bot - 0.5; /* (each column's last card takes its own gap: it has no margin under it) */
    return { z: z, cols: cols, all: all, hs: hs, ft: ft, fh: fh, segs: segs, total: total, avail: avail, fits: total <= avail + 1 };
  }
  function pack(panel, root, w, h, z0) {
    var best = null, zmax = Math.min(ZFIT, z0 * FITMAX);
    for (var z = zmax; z > z0 + 0.001; z = z / 1.06) { var t = trial(panel, root, w, h, z); if (t.fits) { best = t; break; } }
    if (!best) best = trial(panel, root, w, h, z0);
    api.last = { z: best.z, cols: best.cols, total: best.total, avail: best.avail, fits: best.fits };
    unpack(panel, true);
    /* a board that fits one screen gives its spare height to its last block of columns */
    var extra = best.fits ? Math.max(0, best.avail - best.total) : 0, lastBlock = -1;
    best.segs.forEach(function (sg, i) { if (sg.list) lastBlock = i; });
    var r = 1, nseg = best.segs.length, grow = [];
    best.segs.forEach(function (sg, si) {
      if (!sg.list) {
        var s0 = Math.ceil(sg.max / ROW), e0 = best.all[sg.wide]; place(e0, r + " / span " + s0, "1 / -1"); r += s0;
        if (si === nseg - 1) e0.setAttribute("data-ls-end", ""); return;
      }
      var goal = sg.max + (si === lastBlock ? extra : 0), rows = Math.max(1, Math.floor(goal / ROW + 0.001)), span = T / sg.k;
      sg.col.forEach(function (list, c) {
        if (!list.length) return;
        var own = sg.tot[c], spare = Math.max(0, goal - own), acc = 0, prev = 0;
        var wt = list.map(function (i) { return weight(best.all[i]); }), sw = wt.reduce(function (a, b) { return a + b; }, 0);
        if (!sw) { wt = list.map(function () { return 1; }); sw = list.length; }
        list.forEach(function (i, j) {
          var add = spare * wt[j] / sw; acc += best.hs[i] + GAP + add;
          var f = (best.hs[i] + GAP + add) / (best.hs[i] + GAP);
          var end = j === list.length - 1 ? rows : Math.round(acc / ROW), s = Math.max(1, end - prev);
          place(best.all[i], (r + prev) + " / span " + s, (c * span + 1) + " / span " + span); prev += s;
          if (j === list.length - 1 && si === nseg - 1) best.all[i].setAttribute("data-ls-end", "");
          if (f > 1.02) grow.push([best.all[i], f]);
        });
      });
      r += rows;
    });
    best.ft.forEach(function (e, i) { var s = Math.ceil((best.fh[i] + 4) / ROW); place(e, r + " / span " + s, "1 / -1"); e.setAttribute("data-ls-foot", ""); r += s; });
    /* a card that got much taller first grows its type to use the room (largest scale whose words still fit
       the card), then shares out what is left inside */
    grow.forEach(function (it) {
      var e = it[0], f = it[1];
      if (f > 1.12 && !(e.matches(LEAD) && !e.matches(".hot-banner"))) {
        for (var q = Math.min(2.4, f); q > 1.04; q = q / 1.07) {
          e.style.zoom = String(q);
          if (e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1 && fitsIn(e)) { e.setAttribute("data-ls-zoomed", String(Math.round(q * 100) / 100)); break; }
          e.style.zoom = "";
        }
      }
      fill(e, 0);
    });
    root.style.setProperty("--ls-rows", String(r));
  }
  var LEAD = "header, .hdr, [data-ls-lead], [data-ls-span]";
  /* one wrapper holding most of the board (main.ds, div.body) is flattened (display: contents) so its sections
     flow into the columns; a section taller than ~70% of the window is a long list and may continue in the next
     column (its rows never split). Recomputed on every apply (resize). */
  function flatten(panel, vh) {
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-flat]"), function (e) { e.removeAttribute("data-ls-flat"); });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-long]"), function (e) { e.removeAttribute("data-ls-long"); });
    if (panel.hasAttribute("data-ls-grid")) return; /* the board brings its own landscape grid */
    sections(panel).forEach(function (e) {
      if (e.matches(LEAD) || e.matches("footer, .ftr") || e.hasAttribute("data-ls-keep")) return;
      var kids = sections(e); if (kids.length < 2) return;
      var tag = e.tagName; if (tag === "MAIN" || e.classList.contains("body") || e.hasAttribute("data-ls-wrapper")) e.setAttribute("data-ls-flat", "");
    });
    /* LANDFILL2 · a bare list wrapper (no card of its own) holding 3+ cards lets its cards be dealt one by one */
    if (document.documentElement.hasAttribute("data-ls-pack")) for (var pass = 0; pass < 2; pass++) flow(panel).forEach(function (e) {
      if (e.matches(LEAD) || e.matches("footer, .ftr") || e.hasAttribute("data-ls-keep") || e.hasAttribute("data-ls-wide")) return;
      if (boxy(g.getComputedStyle(e))) return;
      var kids = sections(e); if (kids.length < 3) return;
      var cards = kids.filter(function (k) { return boxy(g.getComputedStyle(k)); }).length;
      if (cards >= 3 && cards >= kids.length - 1) e.setAttribute("data-ls-flat", "");
    });
    flow(panel).forEach(function (e) { if (e.getBoundingClientRect().height / (parseFloat(panel.style.zoom) || 1) > vh * 0.7) e.setAttribute("data-ls-long", ""); });
  }
  function flow(panel) {
    var out = [];
    sections(panel).forEach(function (e) {
      if (e.matches(LEAD)) return;
      if (e.hasAttribute("data-ls-flat")) sections(e).forEach(function (k) { if (k.hasAttribute("data-ls-flat")) sections(k).forEach(function (k2) { out.push(k2); }); else out.push(k); }); else out.push(e);
    });
    return out;
  }
  var api = { apply: apply, active: function () { return document.documentElement.hasAttribute("data-landscape"); }, isLandscape: isLandscape };
  g.HouseLandscape = api;
  if (isLandscape()) document.documentElement.setAttribute("data-landscape", "");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  /* PRESSMAP1: a press from the wall lands on page#anchor; the landscape reflow moves it, so bring it back into view once */
  var landed = false;
  function land() {
    if (landed || !location.hash || location.hash.length < 2) return;
    var t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (!t) return;
    landed = true; try { t.scrollIntoView({ block: "start" }); } catch (e) { t.scrollIntoView(); }
  }
  g.addEventListener("load", function () { apply(); setTimeout(land, 60); setTimeout(function () { landed = false; land(); }, 900); });
  g.addEventListener("resize", apply, { passive: true });
  /* LANDFILL2 · boards fill in their data after first paint (musts, lists, photos): deal the cards again when
     the board's content changes. Only text / child changes are watched, never the attributes apply() sets. */
  var tm = 0, busy = false;
  var sig = "";
  function sign() { var p = document.querySelector(".panel"); return p ? p.getElementsByTagName("*").length + ":" + p.textContent.length : ""; }
  function later() {
    if (busy) return; clearTimeout(tm);
    tm = setTimeout(function () { var s2 = sign(); if (s2 === sig) return; busy = true; try { apply(); } finally { sig = sign(); setTimeout(function () { busy = false; }, 0); } }, 120);
  }
  function watch() {
    var panel = document.querySelector(".panel"); if (!panel || !g.MutationObserver) return;
    new MutationObserver(function (recs) { if (!document.documentElement.hasAttribute("data-ls-pack")) return; later(); }).observe(panel, { childList: true, subtree: true, characterData: true });
    panel.addEventListener("load", function (ev) { if (ev.target && ev.target.tagName === "IMG") later(); }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
  g.addEventListener("orientationchange", function () { setTimeout(apply, 60); });
})(window);
