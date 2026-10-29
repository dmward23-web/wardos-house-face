/* ORI3 · SKINX extras loader (Prism P2 extras, a separate layer that can never block the base set). Static, node:vm, no
   browser. Runtime fixtures only (ori3-extras-fixtures.mjs: tiny generated PNGs in the extras layout; no Prism art is
   copied: the extras/ drop 5c0b3990 is on hold for extras-r2). Pins: nothing extra is requested before the base set is
   ready; per-layer failure isolation (any missing or broken file is skipped, never retried, the turkey stays worn);
   lazy requests (sweep / grow on the first grow pulse, splash on the first splash, motes / wings with their power);
   reduced motion (static layers only); the README draw order and blends; ORIX2: the grove grow ripple on every board
   (no theme pick); pebbles mapped to the existing lit / daysOf state with no new counts or text, and none for Ainsley. */
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ROOT, fullDays } from "./ori1-harness.mjs";
import { makeExtras, EXTRAS, OFF, ANX } from "./ori3-extras-fixtures.mjs";

const NOV2 = "2026-11-02T13:00:00Z"; /* Mon Nov 2, 7:00 AM CT */
const NOV4 = "2026-11-04T13:00:00Z"; /* Wed Nov 4: Mon + Tue can be filled days */
const isX = (u) => String(u).includes(EXTRAS);
const xReqs = (h) => [...h.log.images, ...h.log.fetches].map(String).filter(isX);
const base = (u) => String(u).slice(String(u).lastIndexOf("/") + 1);
async function settle(h, n = 4) { for (let i = 0; i < n; i++) { h.advance(120); await h.flush(); } return h; }
async function run(fx, opts = {}) {
  opts = Object.assign({}, opts, { query: "orix=1" + (opts.query ? "&" + opts.query : "") }); /* ORIX2 · extras are preview-only: ?orix=1 */
  const h = boot(Object.assign({ kid: "hayes", at: NOV2, dpr: 1, skinRoot: fx.root, skinBook: fx.book }, opts));
  if (opts.theme) h.ctx.document.documentElement.setAttribute("data-theme", opts.theme);
  await h.flush(); h.ready(); await settle(h);
  return h;
}
const J = (v) => JSON.parse(JSON.stringify(v)); /* vm-realm values to this realm */
const order = (h) => J(h.ctx.MercuryRun.extras().order);

test("load order: no extras request before the base set is ready; extras start only once the hero is worn", async () => {
  const fx = makeExtras();
  try {
    const h = boot({ kid: "hayes", at: NOV2, dpr: 1, skinRoot: fx.root, skinBook: fx.book, query: "orix=1" });
    await h.flush(); h.ready(); await h.flush();
    assert.equal(h.skin().hero, "blob", "base images still loading");
    assert.deepEqual(xReqs(h), [], "nothing from extras/ while the base set loads");
    assert.equal(h.ctx.MercuryRun.extras(), null);
    const nBase = h.log.images.length;
    await settle(h);
    assert.equal(h.skin().hero, "art");
    const first = [...h.log.images].findIndex(isX);
    assert.ok(first >= nBase, "every extras image is requested after the 14 base images");
    assert.ok(xReqs(h).some((u) => u.endsWith("hayes/anchors-extras.json")) && xReqs(h).some((u) => u.endsWith("fx/fx.json")));
  } finally { fx.rm(); }
});

test("load order: a base set that never becomes ready never requests extras (blob fallback is base-only)", async () => {
  const fx = makeExtras({ baseDrop: ["ainsley/1x/sleep.png"] });
  try {
    const h = await run(fx, { kid: "ainsley" });
    await settle(h, 6);
    assert.equal(h.skin().hero, "blob");
    assert.deepEqual(xReqs(h), []);
  } finally { fx.rm(); }
});

test("real tree (ORIX2): only November names an extras dir, the r3 drop, and that dir is in the tree", () => {
  const src = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");
  const reg = src.slice(src.indexOf("var SKINS = {"), src.indexOf("};", src.indexOf("var SKINS = {")));
  const hits = reg.match(/extras: "[^"]*"/g) || [];
  assert.deepEqual(hits, ['extras: "art/mercury/skins/2026-11/extras/"']);
  assert.ok(fs.existsSync(path.join(ROOT, "art/mercury/skins/2026-11/extras/fx/fx.json")));
});

test("first load is lean: only the anchors, fx.json, the states painted so far and the breathe loop; no sweep, grow, splash, drop, motes, wings or pebble-today", async () => {
  const fx = makeExtras();
  try {
    const h = await run(fx);
    const got = xReqs(h).map(base).sort();
    assert.ok(got.includes("shine-idle.png") && got.includes("rim-idle.png") && got.includes("shadow-idle.png"));
    assert.ok(["breathe-2.png", "breathe-3.png", "breathe-4.png"].every((n) => got.includes(n)), "breathe loop fetched once idle paints");
    assert.ok(!got.includes("breathe-1.png"), "breathe-1 = the idle sprite already loaded, not fetched again");
    for (const re of [/^sweep-/, /^grow/, /^splash-/, /^drop-/, /^motes-/, /^wings/, /^pebble-today/]) assert.ok(!got.some((n) => re.test(n)), `${re} not requested on first load: ${got}`);
    const states = new Set(got.filter((n) => /^shine-/.test(n)).map((n) => n.slice(6, -4)));
    assert.ok(states.size <= 3, `per-state layers only for states painted so far (${[...states]})`);
    const dup = xReqs(h).filter((u, i, a) => a.indexOf(u) !== i);
    assert.deepEqual(dup, [], "each file requested once");
  } finally { fx.rm(); }
});

test("lazy: the host's grow pulse is what requests sweep-1..6 and grow-1..6, and the ripple draws over the body", async () => {
  const fx = makeExtras();
  try {
    const h = await run(fx);
    assert.ok(!xReqs(h).some((u) => /sweep-|grow-/.test(u)));
    h.ctx.__mercFillTest("hayes");
    let seen = new Set();
    for (let i = 0; i < 60; i++) { h.advance(16); await h.flush(1); order(h).forEach((o) => seen.add(o)); }
    const got = xReqs(h).map(base);
    for (let i = 1; i <= 6; i++) { assert.ok(got.includes(`sweep-${i}.png`), `sweep-${i}`); assert.ok(got.includes(`grow-${i}.png`), `grow-${i}`); }
    assert.ok(!got.some((n) => /grow-cream/.test(n)), "no theme = base grow frames");
    assert.ok([...seen].some((o) => /^grow-\d$/.test(o)), `grow ripple drew: ${[...seen]}`);
  } finally { fx.rm(); }
});

test("lazy: splash frames are requested on the first splash (a fall), tinted in code, and play once", async () => {
  const fx = makeExtras();
  try {
    const h = await run(fx);
    assert.ok(!xReqs(h).some((u) => /splash-/.test(u)));
    h.pointer("pointerdown", 0, 200);
    let seen = [];
    for (let i = 0; i < 400 && !h.debug().gathers.length; i++) { h.advance(16); await h.flush(1); }
    h.pointer("pointerup", 0, 200);
    assert.ok(h.debug().gathers.length > 0, "the host fell off the left edge");
    for (let i = 0; i < 40; i++) { h.advance(16); await h.flush(1); seen.push(...order(h)); }
    const got = xReqs(h).map(base);
    for (let i = 1; i <= 6; i++) assert.ok(got.includes(`splash-${i}.png`), `splash-${i}`);
    assert.ok(seen.some((o) => /^splash-\d$/.test(o)), "splash drew");
    h.advance(400); await h.flush();
    assert.equal(h.ctx.MercuryRun.extras().order.filter((o) => /^splash/.test(o)).length, 0, "once, then gone");
  } finally { fx.rm(); }
});

test("power marks: wings with the ready double jump and motes with the drop magnet, from the existing power state", async () => {
  const fx = makeExtras();
  try {
    const plain = await run(fx);
    assert.ok(!xReqs(plain).some((u) => /wings|motes/.test(u)), "no power = no power-mark requests");
    const h = await run(fx, { query: "fixture=1" });
    await settle(h, 2);
    const got = xReqs(h).map(base);
    assert.ok(got.includes("wings.png") && got.includes("motes-1.png"));
    assert.ok(order(h).includes("wings") && order(h).includes("motes"), `${order(h)}`);
    assert.ok(!xReqs(h).some((u) => /drop-\d/.test(u)), "drop sprites are not mapped (no pickup in the run)");
  } finally { fx.rm(); }
});

test("draw order and blends follow the README: shadow (multiply), body, eyes, shine (screen), rim (screen)", async () => {
  const fx = makeExtras();
  try {
    const h = await run(fx);
    await settle(h, 2);
    const o = order(h).filter((x) => !/^pebble/.test(x));
    assert.deepEqual(o.slice(0, 5).map((x) => x.replace(/:.*/, "")), ["shadow", "body", "eyes", "shine", "rim"], `${o}`);
    h.log.ops.length = 0; h.advance(16);
    const op = (re) => (h.log.ops.find(([s]) => isX(s) && re.test(base(s))) || [])[1];
    assert.equal(op(/^shadow-/), "multiply");
    assert.equal(op(/^shine-/), "screen");
    assert.equal(op(/^rim-/), "screen");
    const idx = (re) => h.log.ops.findIndex(([s]) => re.test(s));
    assert.ok(idx(/shadow-/) < idx(/qa-x3\/hayes\/1x\/(idle|peek|sleep)\.png|breathe-/) && idx(/qa-x3\/hayes\/1x\/(idle|peek|sleep)\.png|breathe-/) < idx(/eyes-/) && idx(/eyes-/) < idx(/shine-/) && idx(/shine-/) < idx(/rim-/), "actual drawImage order");
  } finally { fx.rm(); }
});

test("draw order: the grow ripple draws after rim; sweep is skipped unless the body is idle (Prism masked it to idle)", async () => {
  const fx = makeExtras();
  try {
    const h = await run(fx);
    h.ctx.__mercFillTest("hayes");
    const frames = [];
    for (let i = 0; i < 80; i++) { h.advance(16); await h.flush(1); frames.push(order(h).filter((x) => !/^pebble/.test(x))); }
    const g = frames.find((o) => o.some((x) => /^grow-/.test(x)));
    assert.ok(g, "a frame with the ripple");
    assert.ok(g.indexOf("rim") < g.findIndex((x) => /^grow-/.test(x)), `${g}`);
    for (const o of frames) if (o.some((x) => /^sweep-\d/.test(x))) assert.ok(o.some((x) => /^body:(idle|breathe-)/.test(x)), `sweep only over idle: ${o}`);
    for (const o of frames) if (o.some((x) => /^sweep-happy-/.test(x))) assert.ok(o.includes("body:happy"), `sweep-happy only over happy: ${o}`);
  } finally { fx.rm(); }
});

const LAYER_FAILS = [
  /* ORIX2 · r3 layers are cropped: with no anchors there is no offset, so the body layers are skipped (never drawn
     misregistered); the turkey still wears and fx still load */
  ["anchors-extras.json broken", { bad: ["hayes/anchors-extras.json"] }, "breathe-2.png", []],
  ["fx.json missing", { drop: ["fx/fx.json"] }, "fx.json", ["shine", "rim", "shadow"]],
  ["shine-idle missing", { drop: ["hayes/1x/shine-idle.png"] }, "shine-idle.png", ["rim", "shadow"]],
  ["rim-idle not a PNG", { bad: ["hayes/1x/rim-idle.png"] }, "rim-idle.png", ["shine", "shadow"]],
  ["shadow-idle missing", { drop: ["hayes/1x/shadow-idle.png"] }, "shadow-idle.png", ["shine", "rim"]],
  ["breathe-3 missing", { drop: ["hayes/1x/breathe-3.png"] }, "breathe-3.png", ["shine", "rim", "shadow"]],
  ["whole kid folder missing", { drop: [...["shine", "rim", "shadow"].flatMap((k) => ["idle", "peek", "sleep", "happy"].map((s) => `hayes/1x/${k}-${s}.png`)), "hayes/anchors-extras.json"] }, "anchors-extras.json", []]
];
for (const [name, opts, dead, keep] of LAYER_FAILS) {
  test(`per-layer isolation: ${name} = that layer skipped silently, never retried; the turkey stays worn; other layers still draw`, async () => {
    const fx = makeExtras(opts);
    try {
      const h = await run(fx);
      await settle(h, 6);
      assert.equal(h.skin().hero, "art", "base turkey worn, never the blob");
      assert.equal(h.skin().finale, "lazy");
      const n = xReqs(h).filter((u) => base(u) === dead).length;
      assert.ok(n <= 1, `${dead} requested at most once (${n})`);
      const seen = new Set(); for (let i = 0; i < 30; i++) { h.advance(16); order(h).forEach((o) => seen.add(o.replace(/:.*/, ""))); }
      for (const k of keep) assert.ok(seen.has(k), `${k} still draws (${[...seen]})`);
      assert.ok(seen.has("body"), "the body always draws");
      assert.equal(xReqs(h).filter((u) => base(u) === dead).length, n, "no retry");
    } finally { fx.rm(); }
  });
}

test("per-layer isolation: a missing grow frame skips only that frame; a missing splash or wings file leaves the rest", async () => {
  const fx = makeExtras({ drop: ["fx/1x/grow-2.png", "fx/1x/wings.png"] });
  try {
    const h = await run(fx, { query: "fixture=1" });
    h.ctx.__mercFillTest("hayes");
    const seen = new Set();
    for (let i = 0; i < 80; i++) { h.advance(16); await h.flush(1); order(h).forEach((o) => seen.add(o)); }
    assert.ok(!seen.has("grow-2") && [...seen].some((o) => /^grow-[13456]$/.test(o)), `${[...seen]}`);
    assert.ok(!seen.has("wings") && seen.has("motes"), "wings failed alone; motes still draw (the code wings stay)");
    assert.equal(h.skin().hero, "art");
  } finally { fx.rm(); }
});

test("reduced motion: no breathe, sweep, grow, splash or motes requested or drawn; shadow, shine, rim, wings and pebbles stay static", async () => {
  const fx = makeExtras();
  try {
    const h = await run(fx, { reduced: true, query: "fixture=1", at: NOV4, checks: fullDays("hayes", ["2026-11-02", "2026-11-03"]) });
    h.ctx.__mercFillTest("hayes");
    h.pointer("pointerdown", 0, 200);
    const seen = new Set();
    for (let i = 0; i < 300; i++) { h.advance(16); if (i % 10 === 0) await h.flush(1); order(h).forEach((o) => seen.add(o)); }
    h.pointer("pointerup", 0, 200); await h.flush();
    assert.equal(h.ctx.MercuryRun.extras().reduced, true);
    const got = xReqs(h).map(base);
    for (const re of [/^breathe-/, /^sweep-/, /^grow/, /^splash-/, /^motes-/]) {
      assert.ok(!got.some((n) => re.test(n)), `${re} never requested`);
      assert.ok(![...seen].some((o) => re.test(o.replace(/^body:/, ""))), `${re} never drawn`);
    }
    for (const k of ["shine", "rim", "shadow", "wings"]) assert.ok(seen.has(k), `${k} drawn (${[...seen]})`);
    assert.ok(seen.has("pebble-filled") || seen.has("pebble-empty"), "pebbles static");
  } finally { fx.rm(); }
});

test("ORIX2 · no theme pick: data-theme=cream or ?theme=cream still plays the grove grow-1..6; grow-cream is never requested", async () => {
  const fx = makeExtras();
  try {
    for (const how of [{ theme: "cream" }, { query: "theme=cream" }, {}]) {
      const h = await run(fx, how);
      assert.deepEqual(J(h.ctx.MercuryRun.extras().grow), { prefix: "grow", n: 6 });
      h.ctx.__mercFillTest("hayes");
      const seen = new Set();
      for (let i = 0; i < 60; i++) { h.advance(16); await h.flush(1); order(h).forEach((o) => seen.add(o)); }
      const got = xReqs(h).map(base);
      for (let i = 1; i <= 6; i++) assert.ok(got.includes(`grow-${i}.png`), `grow-${i}`);
      assert.ok(!got.some((n) => /cream/.test(n)) && ![...seen].some((o) => /cream/.test(o)), `${JSON.stringify(how)}: ${got}`);
    }
  } finally { fx.rm(); }
});

test("ORIX2 · cropped layers draw at offset1x times the scale inside the body canvas (shine / rim / shadow / breathe)", async () => {
  const fx = makeExtras();
  try {
    for (const dpr of [1, 2]) {
      const h = await run(fx, { dpr, reduced: true }); /* reduced: no breathe, so the body is the full-canvas base sprite */
      await settle(h, 2);
      h.log.ops.length = 0; h.advance(16);
      const s = h.ctx.MercuryRun.extras().scale;
      const bodyOp = h.log.ops.find(([u]) => /qa-x3\/hayes\/\dx\/(idle|peek|sleep|happy)\.png$/.test(u));
      const sh = h.log.ops.find(([u]) => /\/shine-/.test(u)), rm = h.log.ops.find(([u]) => /\/rim-/.test(u));
      assert.ok(bodyOp && sh && rm, `ops ${h.log.ops.map((o) => base(o[0]))}`);
      assert.equal(sh[3] - bodyOp[3], OFF[0] * s); assert.equal(sh[4] - bodyOp[4], OFF[1] * s);
      assert.equal(rm[3] - bodyOp[3], OFF[0] * s); assert.equal(rm[4] - bodyOp[4], OFF[1] * s);
      const m = await run(fx, { dpr }); await settle(m, 2); /* breathing: a cropped breathe frame lands where the shine does */
      let br, sn;
      for (let i = 0; i < 40 && !br; i++) { m.log.ops.length = 0; m.advance(16); br = m.log.ops.find(([u]) => /breathe-[234]\.png$/.test(u)); sn = m.log.ops.find(([u]) => /\/shine-idle/.test(u)); }
      assert.ok(br && sn, "a breathe frame drew");
      assert.deepEqual([br[3], br[4]], [sn[3], sn[4]], "breathe frame and shine share offset1x");
    }
  } finally { fx.rm(); }
});

test("ORIX2 · a layer with no offset1x in anchors is skipped, the others still draw", async () => {
  const anx = JSON.parse(JSON.stringify(ANX)); for (const st of Object.keys(anx.shine)) delete anx.layers[`shine-${st}`];
  const fx = makeExtras({ anx });
  try {
    const h = await run(fx); await settle(h, 3);
    const seen = new Set(); for (let i = 0; i < 20; i++) { h.advance(16); order(h).forEach((o) => seen.add(o.replace(/:.*/, ""))); }
    assert.ok(!seen.has("shine") && seen.has("rim") && seen.has("shadow") && seen.has("body"), `${[...seen]}`);
    assert.equal(h.skin().hero, "art");
  } finally { fx.rm(); }
});

test("pebbles: one pebble per existing slot (daysOf), filled = lit; no new kid-facing counts or text", async () => {
  const fx = makeExtras(), cleanup = [fx];
  try {
    const checks = fullDays("hayes", ["2026-11-02", "2026-11-03"]);
    const h = await run(fx, { at: NOV4, checks });
    for (let i = 0; i < 10; i++) { h.advance(200); await h.flush(1); }
    const m = h.merc()[0];
    assert.equal(m.lit, 2, "two filled days revealed");
    const o = order(h);
    assert.equal(o.filter((x) => x === "pebble-filled").length, m.lit);
    assert.equal(o.filter((x) => /^pebble-/.test(x)).length, m.of, "same slot count the interim row shows");
    const fx0 = makeExtras({ noExtrasKey: true }); cleanup.push(fx0);
    const plain = await run(fx0, { at: NOV4, checks });
    for (let i = 0; i < 10; i++) { plain.advance(200); await plain.flush(1); }
    assert.equal(h.texts(), plain.texts(), "kid-facing DOM text identical with and without extras");
    assert.doesNotMatch(h.texts(), /\$|\u2014/);
  } finally { cleanup.forEach((f) => f.rm()); }
});

test("Ainsley: no pebble row for her (a row of filled days is a count), art or interim; nothing pebble is requested", async () => {
  const fx = makeExtras();
  try {
    const checks = fullDays("ainsley", ["2026-11-02", "2026-11-03"]);
    const h = await run(fx, { kid: "ainsley", at: NOV4, checks });
    for (let i = 0; i < 10; i++) { h.advance(200); await h.flush(1); }
    assert.equal(h.skin().hero, "art");
    assert.equal(h.merc()[0].lit, 2, "she still grows by her filled days");
    assert.deepEqual(J(h.ctx.MercuryRun.extras().pebblesHidden), ["ainsley"]);
    assert.ok(!order(h).some((x) => /^pebble/.test(x)));
    assert.ok(!xReqs(h).some((u) => /pebble/.test(u)));
    assert.doesNotMatch(h.texts(), /\$|\u2014|\bstars?\b|\d+\s*(of|\/)\s*\d+/i);
  } finally { fx.rm(); }
});

test("source: the ORI3 extras code adds no kid copy, no $ and no em dash, and draws no art (composites Prism layers only)", () => {
  const src = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");
  const a = src.indexOf("/* ORI3 · SKINX extras"), b = src.indexOf("function pebblesHiddenFor");
  assert.ok(a > 0 && b > a);
  const blk = src.slice(a, b);
  assert.doesNotMatch(blk, /\u2014/);
  assert.doesNotMatch(blk, /innerHTML|textContent|fillText|note\(/, "no text");
  assert.doesNotMatch(blk, /\b(arc|ellipse|bezierCurveTo|quadraticCurveTo|lineTo|createRadialGradient|createLinearGradient)\(/, "no code-drawn shapes");
});

test("airborne shadow stays on the ground line and shrinks / fades with height (scale toward 0.6, opacity toward 0.4)", async () => {
  const fx = makeExtras();
  try {
    const h = await run(fx);
    h.log.ops.length = 0;
    h.pointer("pointerdown", 240, 160); h.advance(16); h.pointer("pointerup", 240, 160);
    const alphas = [];
    for (let i = 0; i < 40; i++) { h.log.ops.length = 0; h.advance(16); const s = h.log.ops.find(([src]) => /shadow-/.test(src)); if (s && !h.merc()[0].grounded) alphas.push(s[2]); }
    assert.ok(alphas.length > 3, "shadow drawn while airborne");
    const lo = Math.min(...alphas);
    assert.ok(lo < 0.95 && lo >= 0.4 - 1e-9, `fades with height, floor 0.4 (min ${lo})`);
  } finally { fx.rm(); }
});
