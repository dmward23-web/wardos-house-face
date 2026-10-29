/* ORI1 · static vm harness for mercury-run.js (no browser, no Chrome). Loads the REAL house-clock.js, kids-data.js,
   jar-engine.js and mercury-run.js from a tree root into one node:vm context with a fake DOM, a fake 2D canvas, a
   controllable wall clock (Date) and a frame clock (performance.now, rAF, timers). Root = this worktree by default;
   ORI1_ROOT=<dir> points it at another tree (the fails-before run against 1ea4cddd uses it). */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = process.env.ORI1_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FXROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const rd = (f, root = ROOT) => fs.readFileSync(path.join(root, f), "utf8");
export const FX = JSON.parse(fs.readFileSync(path.join(FXROOT, "scripts/qa/fixtures/hayesjar1c-week.json"), "utf8"));

function ctx2d(log) {
  const store = {};
  const noop = () => {};
  const img = (w, h) => ({ width: w | 0, height: h | 0, data: new Uint8ClampedArray(Math.max(0, (w | 0) * (h | 0) * 4)) });
  const special = {
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}), measureText: (s) => ({ width: String(s).length * 7 }),
    fillText: (t) => { log.writes.push(["fillText", String(t)]); }, strokeText: (t) => { log.writes.push(["strokeText", String(t)]); }, /* ORIX2 · transient text log */
    getImageData: (x, y, w, h) => { const d = img(w, h); d.data.fill(120); return d; },
    createImageData: (w, h) => img(w, h),
    putImageData: (d) => { log.put.push(d); },
    drawImage: (im, x, y) => { if (im && im._src) { log.drawn.push(im._src); log.ops.push([im._src, store.globalCompositeOperation || "source-over", store.globalAlpha == null ? 1 : store.globalAlpha, x, y]); } }, /* ORIX2 · + x, y */
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), isPointInPath: () => false
  };
  return new Proxy(store, {
    get: (t, k) => (k in special ? special[k] : k in t ? t[k] : noop),
    set: (t, k, v) => { t[k] = v; return true; }
  });
}

function makeEl(tag, log) {
  const attrs = {}; const cls = new Set(); const kids = [];
  const e = {
    tagName: String(tag).toUpperCase(), style: {}, children: kids, _text: "", _html: "", width: 300, height: 150,
    get textContent() { return this._text; }, set textContent(v) { this._text = String(v); log.writes.push(["textContent", this._text]); }, /* ORIX2 · every write logged */
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); log.writes.push(["innerHTML", this._html]); kids.length = 0; this._q = {}; },
    get className() { return [...cls].join(" "); }, set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
    classList: { add: (...a) => a.forEach((c) => cls.add(c)), remove: (...a) => a.forEach((c) => cls.delete(c)), contains: (c) => cls.has(c), toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); } },
    setAttribute: (k, v) => { attrs[k] = String(v); log.writes.push(["attr:" + k, String(v)]); }, getAttribute: (k) => (k in attrs ? attrs[k] : null), removeAttribute: (k) => { delete attrs[k]; },
    appendChild: (c) => { kids.push(c); c.parentNode = e; return c; }, removeChild: (c) => { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); return c; },
    remove() { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: (t, f) => { (e._ev[t] = e._ev[t] || []).push(f); }, removeEventListener() {}, _ev: {}, _q: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: log.view.w, bottom: log.view.h, width: log.view.w, height: log.view.h }),
    setPointerCapture() {}, releasePointerCapture() {}, focus() {},
    getContext: (kind) => (kind === "2d" ? (e._ctx = e._ctx || ctx2d(log)) : null),
    toDataURL: () => "data:,",
    querySelector(sel) {
      for (const c of kids) if (sel === "." + c.className.split(" ")[0] || (c.className && sel.startsWith(".") && c.classList.contains(sel.slice(1)))) return c;
      const m = sel.match(/^\.([\w-]+)(?:\s+(\w+))?$/);
      if (!m || !new RegExp('class="[^"]*\\b' + m[1] + '\\b').test(this._html)) return null;
      return (this._q[sel] = this._q[sel] || makeEl(m[2] || "div", log));
    },
    querySelectorAll: () => []
  };
  return e;
}

export function boot(opts = {}) {
  const o = Object.assign({ kid: "hayes", coop: null, at: FX.clock.wed0700, checks: {}, w: 480, h: 320, root: ROOT, data: FX.data, query: "", liquid: false }, opts);
  const log = { put: [], chimes: 0, view: { w: o.w, h: o.h }, images: [], fetches: [], drawn: [], ops: [], writes: [], nav: [] };
  /* files: a URL resolves against the tree root, then the fixture root (QA skin fixtures live in scripts/qa/fixtures) */
  const fileFor = (url) => { const u = String(url).split("?")[0]; for (const r of [o.root, FXROOT, o.skinRoot].filter(Boolean)) { const f = path.join(r, u); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; } return null; };
  const pngSize = (f) => { const b = fs.readFileSync(f); return b.slice(1, 4).toString() === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : { w: 0, h: 0 }; };
  const clock = { wall: Date.parse(o.at), perf: 1000 };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(clock.wall); }
    static now() { return clock.wall; }
  }
  const timers = []; let tid = 1; let rafs = [];
  const win = {}, docEv = {};
  const map = {};
  const storage = { getItem: (k) => (k in map ? map[k] : null), setItem: (k, v) => { map[k] = String(v); log.writes.push(["localStorage", String(k) + "=" + String(v)]); }, removeItem: (k) => { delete map[k]; }, key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const els = { run: makeEl("canvas", log), "run-ui": makeEl("div", log) };
  const body = makeEl("body", log);
  const document = {
    readyState: "complete", hidden: false, visibilityState: "visible", body,
    get cookie() { return log.cookie || ""; }, set cookie(v) { log.cookie = String(v); log.writes.push(["cookie", String(v)]); }, /* ORIX2 · cookie writes are logged */ documentElement: makeEl("html", log), head: makeEl("head", log),
    getElementById: (id) => els[id] || (id === "je" && els["run-ui"]._html.includes('id="je"') ? (els.je = els.je || makeEl("div", log)) : null),
    createElement: (t) => makeEl(t, log), querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (t, f) => { (docEv[t] = docEv[t] || []).push(f); }, removeEventListener() {},
    dispatchEvent: (ev) => { (docEv[ev.type] || []).slice().forEach((f) => f(ev)); return true; }
  };
  const params = new URLSearchParams(o.query);
  params.set("kid", o.kid); if (o.coop) params.set("coop", o.coop);
  if (!o.liquid) params.set("liquid", "0"); /* the per-pixel chrome is slow in a vm; physics and skins are paint-path blind (one test keeps it on) */
  const ctx = vm.createContext({
    Intl, Math, JSON, URL, URLSearchParams, Promise, Uint8ClampedArray, Uint8Array, Float32Array, Array, Object, String, Number, console, WeakMap, Map, Set, Symbol, Proxy, Error,
    Date: FakeDate, parseInt, parseFloat, isFinite, isNaN,
    performance: { now: () => clock.perf },
    setTimeout: (f, ms) => { const id = tid++; timers.push({ id, at: clock.perf + (ms || 0), f, every: 0 }); return id; },
    setInterval: (f, ms) => { const id = tid++; timers.push({ id, at: clock.perf + ms, f, every: ms }); return id; },
    clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    clearInterval: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    requestAnimationFrame: (f) => { rafs.push(f); return rafs.length; }, cancelAnimationFrame() {},
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
    Event: class { constructor(t) { this.type = t; } },
    Image: class {
      constructor() { this.width = 0; this.height = 0; this.complete = false; }
      get src() { return this._src; }
      set src(v) {
        this._src = v; log.images.push(v); const f = fileFor(v), im = this;
        ctx.setTimeout(() => { if (f) { const d = pngSize(f); im.width = d.w; im.height = d.h; im.complete = true; im.onload && im.onload(); } else { im.complete = true; im.onerror && im.onerror(); } }, 5);
      }
    },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem: (k, v) => { log.writes.push(["sessionStorage", String(k) + "=" + String(v)]); }, removeItem() {} },
    document, location: { search: "?" + params.toString(), hash: "", pathname: "/mercury-run.html", href: "https://house.test/mercury-run.html?" + params.toString(), reload() {} },
    indexedDB: { open: (n) => { log.writes.push(["indexedDB", "open " + String(n)]); return { set onsuccess(f) {}, set onerror(f) {}, set onupgradeneeded(f) {} }; }, deleteDatabase: (n) => { log.writes.push(["indexedDB", "delete " + String(n)]); return {}; } }, /* ORIX2 · IndexedDB opens are logged as writes */
    history: { state: null, replaceState(st, t, u) { log.nav.push(["replaceState", String(u == null ? "" : u)]); }, pushState(st, t, u) { log.nav.push(["pushState", String(u == null ? "" : u)]); } }, /* ORIX2 · URL rewrites are logged */ navigator: { userAgent: "node", hardwareConcurrency: 8, deviceMemory: 8 },
    matchMedia: (mq) => ({ matches: !!o.reduced && /reduced-motion:\s*reduce/.test(String(mq)), addEventListener() {} }), /* ORI3 · reduced: true = prefers-reduced-motion */
    fetch: (url) => { log.fetches.push(url); const f = fileFor(url); return Promise.resolve(f ? { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(f, "utf8")) } : { ok: false, status: 404, json: async () => null }); },
    innerWidth: o.w, innerHeight: o.h, devicePixelRatio: o.dpr || 1,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    HouseSfx: { quest: () => { log.chimes += 1; }, isMuted: () => true, unlockAudio() {}, ensureCtx: () => null, masterGain: () => null, tap() {}, questPop() {} }
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = (t, f) => { (win[t] = win[t] || []).push(f); };
  ctx.removeEventListener = () => {};
  ctx.dispatchEvent = (ev) => { (win[ev.type] || []).slice().forEach((f) => f(ev)); return true; };
  /* seed checks BEFORE kids-data loads: { kid: { iso: [ids] } } as daily keys */
  for (const [k, days] of Object.entries(o.checks)) for (const [iso, ids] of Object.entries(days)) {
    const st = {}; ids.forEach((id) => { st[id] = true; }); map["house-checkoffs:" + k + ":" + iso] = JSON.stringify(st);
  }
  if (o.skinBook) ctx.MercurySkinBook = o.skinBook;
  const run = (f) => vm.runInContext(rd(f, o.root), ctx, { filename: f });
  run("house-clock.js");
  run("kids-data.js");
  ctx.WardKids._data = o.data;
  ctx.WardKids.boot = () => {};       /* the hub fetch is not under test: the test dispatches kids-data-ready itself */
  run("jar-engine.js");
  run("mercury-run.js");

  const api = {
    ctx, log, clock, map, els, ui: els["run-ui"],
    fire: (t, target = "doc") => { const ev = { type: t, detail: {} }; if (target === "doc") document.dispatchEvent(ev); else ctx.dispatchEvent(ev); },
    ready() { api.fire("house:kids-data-ready"); return api; },
    advance(ms, step = 16) {
      for (let el = 0; el < ms; el += step) {
        clock.perf += step; clock.wall += step;
        timers.sort((a, b) => a.at - b.at);
        while (timers.length && timers[0].at <= clock.perf) {
          const t = timers.shift(); if (t.every) timers.push(Object.assign({}, t, { at: t.at + t.every }));
          t.f();
        }
        const fr = rafs; rafs = []; fr.forEach((f) => f(clock.perf));
      }
      return api;
    },
    async flush(n = 6) { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); return api; },
    skin: () => (ctx.MercuryRun && ctx.MercuryRun.skin ? ctx.MercuryRun.skin() : null),
    setWall(iso) { clock.wall = Date.parse(iso); return api; },
    /* a tap as stored (same key builder the boards use); straight into storage so no tapsync/hub side effects */
    tick(id, iso) { const key = ctx.WardKids.checkKeyFor(id, o.data, iso); const st = JSON.parse(map[key] || "{}"); st[id] = true; map[key] = JSON.stringify(st); return api; },
    fullWeek(kid) { FX.week.taps.forEach((d) => dailyIds(kid, o.data).forEach((id) => api.tick(id, d))); weeklyIds(kid, o.data).forEach((id) => api.tick(id, FX.week.taps[4])); return api; },
    pointer(type, x, y, id = 1) {
      const ev = { type, pointerId: id, clientX: x, clientY: y, isTrusted: true, preventDefault() {}, stopPropagation() {} };
      (els.run._ev[type] || []).forEach((f) => f(ev));
      return api;
    },
    merc: () => (ctx.__merc ? ctx.__merc() : null),
    debug: () => ctx.MercuryRun.debug(),
    texts() {
      const out = [els["run-ui"]._html];
      const walk = (e) => { out.push(e._html || "", e.textContent || ""); (e.children || []).forEach(walk); Object.values(e._q || {}).forEach(walk); };
      walk(els["run-ui"]);
      return out.join("\n");
    }
  };
  return api;
}

/* the fixture's daily musts per kid, and a helper for "these days fully done" */
export function dailyIds(kid, data = FX.data) { return data.kids[kid].quests.filter((q) => (q.cadence || "daily") === "daily" && !q.optional && q.cadence !== "addon").map((q) => q.id); }
export function weeklyIds(kid, data = FX.data) { return data.kids[kid].quests.filter((q) => q.cadence === "weekly").map((q) => q.id); }
export function fullDays(kid, isos) { const o = {}; isos.forEach((d) => { o[d] = dailyIds(kid); }); return { [kid]: o }; }
