/* SUNHOME audit · behavior, not source greps.
   Renders the real hub face painter, jar painter, pebble counter, rest pill and idea slots
   against feed fixtures: Ainsley offline / bad / placeholder, boys must progression, no "$". */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function node(tag) {
  const n = {
    tagName: String(tag || "div").toUpperCase(),
    attrs: {},
    kids: [],
    parent: null,
    hidden: false,
    className: "",
    type: "",
    textContent: "",
    _html: "",
    style: { color: "", setProperty() {} },
    scrollHeight: 0,
    clientHeight: 100,
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
    appendChild(c) { c.parent = this; this.kids.push(c); return c; },
    insertBefore(c, ref) {
      c.parent = this;
      const i = this.kids.indexOf(ref);
      if (i < 0) this.kids.push(c); else this.kids.splice(i, 0, c);
      return c;
    },
    removeChild(c) { this.kids = this.kids.filter((k) => k !== c); c.parent = null; },
    addEventListener() {},
    closest() { return null; }
  };
  n.classList = {
    add(c) { if (!n.classList.contains(c)) n.className = (n.className + " " + c).trim(); },
    remove(c) { n.className = n.className.split(/\s+/).filter((x) => x && x !== c).join(" "); },
    contains(c) { return n.className.split(/\s+/).includes(c); },
    toggle() {}
  };
  Object.defineProperty(n, "innerHTML", {
    get() { return n._html; },
    set(v) {
      n._html = String(v);
      n.kids = [];
      const re = /<([a-z0-9]+)([^>]*)>/gi;
      let m;
      while ((m = re.exec(v))) {
        if (m[1].toLowerCase() === "button") continue;
        const c = node(m[1]);
        const id = /id="([^"]+)"/.exec(m[2]);
        if (id) c.attrs.id = id[1];
        const cls = /class="([^"]+)"/.exec(m[2]);
        if (cls) c.className = cls[1];
        for (const a of m[2].matchAll(/\b(data-[\w-]+)/g)) c.attrs[a[1]] = "";
        c.parent = n;
        n.kids.push(c);
      }
    }
  });
  n.querySelector = (sel) => query(n, sel);
  n.querySelectorAll = (sel) => queryAll(n, sel);
  return n;
}

function match(n, sel) {
  sel = sel.trim();
  if (sel.startsWith("#")) return n.attrs.id === sel.slice(1);
  if (sel.startsWith(".")) return n.className.split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith("[") && sel.endsWith("]")) {
    const body = sel.slice(1, -1);
    const eq = body.indexOf("=");
    if (eq < 0) return n.hasAttribute(body);
    return n.getAttribute(body.slice(0, eq)) === body.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return n.tagName === sel.toUpperCase();
}

function queryAll(root, sel) {
  const out = [];
  const parts = sel.split(",").map((s) => s.trim());
  function walk(n) {
    for (const p of parts) if (match(n, p)) out.push(n);
    for (const k of n.kids || []) walk(k);
  }
  for (const k of root.kids || []) walk(k);
  return out;
}
function query(root, sel) { return queryAll(root, sel)[0] || null; }

function makeDocument(extra) {
  const listeners = {};
  const doc = node("document");
  doc.readyState = "loading";
  doc.documentElement = node("html");
  doc.body = node("body");
  doc.body.attrs = Object.assign({}, extra || {});
  doc.documentElement.classList = doc.body.classList;
  doc.createElement = (tag) => node(tag);
  doc.addEventListener = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  doc.removeEventListener = () => {};
  doc.dispatchEvent = (ev) => { (listeners[ev.type] || []).forEach((fn) => fn(ev)); return true; };
  doc.querySelector = (sel) => query(doc, sel) || query(doc.body, sel) || query(doc.documentElement, sel);
  doc.querySelectorAll = (sel) => queryAll(doc, sel).concat(queryAll(doc.body, sel));
  doc.kids = [doc.documentElement, doc.body];
  doc._listeners = listeners;
  return doc;
}

function load(file, ctx) {
  vm.runInContext(rd(file), ctx, { filename: file });
}

test("Ainsley hub faces: stars, XP, streak and $ never render, offline or with a money feed", () => {
  const document = makeDocument();
  const ctx = vm.createContext({
    document, window: null, location: { search: "", pathname: "/sheet-index.html" },
    Intl, URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    matchMedia: () => ({ matches: false })
  });
  ctx.window = ctx;
  ctx.global = ctx;
  const checks = {};
  ctx.WardKids = {
    DAY_ISO: "2026-11-08",
    _data: {
      kids: {
        ainsley: { name: "Ainsley", quests: [{ id: "a1", what: "Bed $5", cadence: "daily" }], bank: { currency: { symbol: "$" } } },
        hayes: { name: "Hayes", quests: [{ id: "h1", what: "Pack", cadence: "daily" }, { id: "h2", what: "Read", cadence: "daily" }, { id: "h3", what: "Dishes", cadence: "daily" }] }
      }
    },
    mustQuests(id, data) { return ((data.kids[id] || {}).quests || []).filter((q) => q.cadence !== "addon"); },
    getCheck(id) { return !!checks[id]; },
    mustProgress() { return { done: 1, need: 1, complete: true }; },
    getBankView() { return { currency: { symbol: "$" }, week: 4, need: 10, pct: 40, mustComplete: false }; }
  };
  load("house-kid-engage.js", ctx);
  const E = ctx.HouseKidEngage;
  assert.deepEqual(Array.from(E.facesFor("ainsley")), ["day", "chores", "leave"]);
  assert.ok(!Array.from(E.facesFor("ainsley")).includes("stars"));
  assert.deepEqual(Array.from(E.facesFor("hayes")), ["day", "stars", "chores", "leave"]);

  const banned = /\$|★|⭐|🔥|streak|XP|Stars · jar|kf-xp/i;
  for (const face of ["day", "stars", "chores", "leave"]) {
    const html = E.paintFace("ainsley", face);
    assert.doesNotMatch(html, banned, face + " " + html);
    assert.doesNotMatch(html, /kf-streak|data-streak/, face);
  }
  const tile = node("a");
  tile.attrs["data-kid-flip"] = "ainsley";
  tile.attrs["data-face"] = "stars";
  const stage = node("div"); stage.attrs["data-kf-stage"] = "1";
  const dots = node("div"); dots.attrs["data-kf-dots"] = "1";
  const streak = node("div"); streak.attrs["data-kf-streak"] = "1"; streak.textContent = "3/3";
  tile.kids = [stage, dots, streak];
  tile.querySelector = (sel) => query(tile, sel);
  E.paintTile(tile);
  assert.equal(tile.getAttribute("data-face"), "day");
  assert.doesNotMatch(stage.innerHTML, banned);
  assert.doesNotMatch(dots.innerHTML, /stars/);
  assert.equal(streak.hidden, true);
  assert.equal(streak.textContent, "");

  const boy = E.paintFace("hayes", "stars");
  assert.doesNotMatch(boy, /\$/, boy);
  assert.match(boy, /kf-xp/);
});

test("Ainsley jar: offline, bad JSON, and the word trusted paint the empty line; a real sentence is the grant", async () => {
  const document = makeDocument();
  const el = node("div");
  el.attrs["data-jar-state"] = "trusted";
  el.textContent = "TRUSTED";
  document.body.kids.push(el);
  const feeds = [];
  const ctx = vm.createContext({
    document, Promise,
    fetch: (url) => {
      feeds.push(url);
      const mode = feeds.length;
      if (mode === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve({ ok: false, status: 503, json: () => Promise.reject(new Error("bad")) });
    }
  });
  ctx.window = ctx;
  document.readyState = "complete";
  load("ains-jar-state.js", ctx);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(el.textContent, "Nothing trusted yet.");
  assert.equal(el.getAttribute("data-jar-state"), "unset");
  ctx.AinsJarState.paint({ kids: { ainsley: { jarState: "trusted" } } });
  assert.equal(el.textContent, "Nothing trusted yet.");
  ctx.AinsJarState.paint("{not json");
  assert.equal(el.textContent, "Nothing trusted yet.");
  ctx.AinsJarState.paint({ kids: { ainsley: { jarState: "She walks to the library" } } });
  assert.equal(el.textContent, "She walks to the library");
  assert.equal(el.getAttribute("data-jar-state"), "grant");
});

test("boys pebble reaches filled only when every must is actually done", () => {
  const document = makeDocument();
  const ctx = vm.createContext({
    document, location: { search: "" }, matchMedia: () => ({ matches: false }),
    Intl, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}
  });
  ctx.window = ctx;
  ctx.global = ctx;
  load("kid-world.js", ctx);
  const P = ctx.KidPebble;
  assert.equal(P.fromCounts(0, 3), "empty");
  assert.equal(P.fromCounts(1, 3), "today-1");
  assert.equal(P.fromCounts(2, 3), "today-3");
  assert.equal(P.fromCounts(3, 3), "filled");
  assert.equal(P.fromCounts(2, 6), "today-1");
  assert.equal(P.fromCounts(4, 6), "today-2");
  assert.equal(P.fromCounts(5, 6), "today-3");
  assert.notEqual(P.fromCounts(5, 6), "filled");
  const done = new Set();
  ctx.WardKids = {
    DAY_ISO: "2026-11-08",
    _data: { kids: { hayes: { quests: [{ id: "h1" }, { id: "h2" }, { id: "h3" }] } } },
    mustQuests(id, data) { return (data.kids[id] && data.kids[id].quests) || []; },
    getCheck(id) { return done.has(id); }
  };
  assert.equal(P.forKid("hayes"), "empty");
  done.add("h1");
  assert.equal(P.forKid("hayes"), "today-1");
  done.add("h2");
  assert.equal(P.forKid("hayes"), "today-3");
  done.add("h3");
  assert.equal(P.forKid("hayes"), "filled");
  assert.equal(P.forKid("ainsley"), "empty");
});

test("rest pill follows the missing-feed event and does not use an em dash or a timer", () => {
  const document = makeDocument({ "data-kid": "hayes" });
  const ctx = vm.createContext({
    document, location: { search: "" }, matchMedia: () => ({ matches: false }),
    Intl, console, setTimeout: () => { throw new Error("rest must not arm a timer"); }, clearTimeout() {}, setInterval: () => 0, clearInterval() {}
  });
  ctx.window = ctx;
  ctx.global = ctx;
  load("kid-world.js", ctx);
  assert.equal(ctx.KidFeedRest.line, "Resting. Your list comes back soon.");
  assert.ok(!ctx.KidFeedRest.line.includes("\u2014"));
  const stage = node("div");
  document.body.appendChild(stage);
  ctx.KidFeedRest.bind(stage);
  assert.equal(document.querySelector("[data-kw-feed]"), null);
  document.dispatchEvent({ type: "house:kids-data-missing" });
  const pill = stage.querySelector("[data-kw-feed]");
  assert.ok(pill, "the missing event paints the pill");
  assert.equal(pill.textContent, "Resting. Your list comes back soon.");
  assert.equal(pill.hidden, false);
  assert.ok(document.body.classList.contains("kw-rest"));
  document.dispatchEvent({ type: "house:kids-data-ready" });
  assert.equal(pill.hidden, true);
  assert.ok(!document.body.classList.contains("kw-rest"));
});

test("Ainsley My Week with no days renders the locked empty line; Hayes keeps the generic line", () => {
  function run(kid) {
    const document = makeDocument({ "data-kid": kid });
    document.readyState = "complete";
    const host = node("section");
    host.attrs.id = "sec-days";
    document.body.kids.push(host);
    const timers = [];
    const ctx = vm.createContext({
      document, location: { search: "" },
      Intl, console,
      setTimeout: (fn) => { timers.push(fn); return 1; },
      clearTimeout() {},
      Date, Math
    });
    ctx.window = ctx;
    ctx.global = ctx;
    ctx.WardKids = { DAY_ISO: "2026-11-08", _data: null };
    load("calendar-world.js", ctx);
    timers.forEach((fn) => fn());
    const cw = host.querySelector("[data-cw]");
    const path = cw && cw.querySelector("[data-cw-path]");
    assert.ok(path, kid);
    return path.innerHTML;
  }
  assert.equal(run("ainsley"), "<p>Nothing on your week yet.</p>");
  assert.equal(run("hayes"), "<p>A free week.</p>");
});

test("idea slots are never a blank button: one Ideas live here, later empties hidden", () => {
  const document = makeDocument();
  const slots = [0, 1, 2].map(() => {
    const s = node("div");
    s.className = "opt empty-slot";
    const t = node("div"); t.className = "title"; t.textContent = "baked";
    const sub = node("div"); sub.className = "sub";
    s.kids = [t, sub];
    s.querySelector = (sel) => query(s, sel);
    return s;
  });
  document.querySelectorAll = (sel) => sel === ".opt.empty-slot" ? slots : queryAll(document, sel);
  document.querySelector = () => null;
  const store = {};
  const ctx = vm.createContext({
    document,
    location: { pathname: "/sheet-weekend.html" },
    localStorage: { getItem: (k) => store[k] || null, setItem(k, v) { store[k] = v; } },
    prompt: () => ""
  });
  ctx.window = ctx;
  load("house-addlist.js", ctx);
  assert.equal(slots[0].hidden, false);
  assert.equal(slots[0].querySelector(".title").textContent, "Ideas live here.");
  assert.equal(slots[1].hidden, true);
  assert.equal(slots[2].hidden, true);
  assert.ok(slots.every((s) => s.hidden || s.querySelector(".title").textContent.trim() !== ""));
});

test("kid pages do not load the money script, and a $ feed does not reach hub glass", () => {
  for (const f of ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]) {
    assert.doesNotMatch(rd(f), /house-money-bind\.js/, f);
  }
  for (const rel of [
    "month-theme/november/wall-morning.webp", "month-theme/november/wall-dusk.webp", "month-theme/november/wall-night.webp",
    "month-theme/november/phone-morning.webp", "month-theme/november/phone-dusk.webp", "month-theme/november/phone-night.webp",
    "month-theme/november/pebble/pebble-empty.webp", "month-theme/november/pebble/pebble-filled.webp",
    "month-theme/november/hub-window-dusk.webp", "month-theme/november/hub-window-night.webp"
  ]) assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
  const css = rd("kid-world.css");
  assert.match(css, /month-theme\/november\/pebble\/pebble-filled\.webp/);
  assert.doesNotMatch(css, /art\/mercury\/skins\/2026-11\/extras\/fx\/2x\/pebble/);
  assert.doesNotMatch(css, /day-tap:not\(\.is-today\)\s*\{[^}]*display:\s*none/);
});

test("hub kid tiles keep their world art over the shorthand backgrounds", () => {
  const hub = rd("sheet-index.html");
  const shorthand = hub.lastIndexOf("background: linear-gradient(165deg, rgba(16,18,24,0.98)");
  const art = hub.lastIndexOf("kidtile-ainsley.webp");
  assert.ok(art > shorthand, "kidtile rule must follow the !important shorthand");
  assert.match(hub, /background-image:\s*url\("month-theme\/hub\/kidtile-ainsley\.webp"\)\s*!important/);
  assert.match(hub, /background-image:\s*url\("month-theme\/hub\/kidtile-hayes\.webp"\)\s*!important/);
  assert.match(hub, /background-image:\s*url\("month-theme\/hub\/kidtile-harris\.webp"\)\s*!important/);
  assert.match(hub, /background-size:\s*cover\s*!important/);
});

test("hub home control is the house glyph, and Jars stays on the adult chores board", () => {
  const hub = rd("sheet-index.html");
  assert.match(hub, /class="hub-home" href="sheet-index\.html" aria-label="Back to the House board"/);
  assert.match(hub, /assets\/icons\/home-key-light\.svg/);
  const jars = hub.slice(hub.indexOf('class="tile stars"'), hub.indexOf('class="tile fun"'));
  assert.match(jars, /href="sheet-chores\.html"/);
  assert.doesNotMatch(jars, /sheet-allowance/);
  for (const f of ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]) {
    assert.doesNotMatch(rd(f), /sheet-allowance/, f);
  }
});

test("mute is a speaker, and Ainsley's jar hides empty progress bars", () => {
  const snd = rd("house-sound.js");
  assert.match(snd, /\.house-snd \.x\{display:none\}/);
  assert.doesNotMatch(snd, /html:not\(\[data-sound=on\]\) \.house-snd \.x\{display:inline\}/);
  const css = rd("kid-world.css");
  assert.match(css, /body\.theme-ainsley \.bank-track,\s*body\.theme-ainsley \.grow-meter/);
  assert.match(css, /display:\s*none\s*!important/);
});

const SPOOK_LINES = ["Boo. Did I spook you?", "Happy haunting.", "The pumpkins are whispering."];

test("November hub does not request the Halloween spook layer or the porch scene", () => {
  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "plates") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".html")) out.push(path.relative(ROOT, p));
    }
    return out;
  }
  for (const rel of walk(ROOT)) {
    assert.doesNotMatch(rd(rel), /wg-spook\.(?:js|css)/, rel + " still loads the scare");
  }
  const hub = rd("sheet-index.html");
  for (const line of SPOOK_LINES) assert.equal(hub.includes(line), false, line);
  assert.match(rd("month-theme/month-overlay.css"), /iframe\.night52-scene\{[^}]*display:\s*none/);

  function bootNight(iso, search) {
    const made = [];
    const body = { getAttribute: () => null, insertBefore() {}, appendChild() {} };
    const document = {
      body,
      documentElement: { classList: { add() {} }, hasAttribute: () => false },
      createElement(tag) {
        const el = { tag, src: "", className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, classList: { toggle() {} } };
        made.push(el);
        return el;
      },
      addEventListener() {}
    };
    const fixed = Date.parse(iso);
    class FakeDate extends Date {
      constructor(...a) { super(...(a.length ? a : [fixed])); }
      static now() { return fixed; }
    }
    const ctx = vm.createContext({
      document, Date: FakeDate, Intl, URLSearchParams, console,
      location: { search: search || "", pathname: "/sheet-index.html", origin: "http://hub.local" },
      innerWidth: 1080, innerHeight: 1920,
      localStorage: { getItem: () => null, setItem() {} }
    });
    ctx.window = ctx;
    vm.runInContext(rd("night/night-host.js"), ctx, { filename: "night/night-host.js" });
    return { made, night: ctx.HouseNight };
  }
  const nov = bootNight("2026-11-08T17:30:00-06:00");
  assert.equal(nov.night.on, false);
  assert.equal(nov.made.some((el) => /scene\.html/.test(el.src)), false, "November must not request the Halloween scene");
  const oct = bootNight("2026-10-20T20:00:00-05:00");
  assert.equal(oct.night.on, true);
  assert.ok(oct.made.some((el) => /scene\.html/.test(el.src)), "other months still have the night scene");
  const pinned = bootNight("2026-10-20T20:00:00-05:00", "?month=11");
  assert.equal(pinned.made.some((el) => /scene\.html/.test(el.src)), false, "a pinned November does not load the scene");
});
