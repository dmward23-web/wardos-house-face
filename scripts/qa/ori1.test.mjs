import fs from "node:fs";
/* ORI1 · Phase 1 behaviour tests for the Mercury run (static, node:vm, no browser). Each test names the ORI1 ask it
   pins. The same file runs against the pre-ORI1 tree with ORI1_ROOT=<dir with 1ea4cddd files> (fails-before). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, rd, FX, fullDays, ROOT } from "./ori1-harness.mjs";
import { makeSkinFixtures, FIXDIR } from "./ori1-skin-fixtures.mjs";
const SKINROOT = makeSkinFixtures();
process.on("exit", () => { try { fs.rmSync(SKINROOT, { recursive: true, force: true }); } catch (e) {} });

const TAPS = FX.week.taps;                       /* Sat 10-24 .. Fri 10-30 */
const R0 = 26;
const J = (x) => JSON.parse(JSON.stringify(x));   /* vm-realm arrays -> this realm, for deepEqual */
const settle = (h, ms = 700) => h.ready().advance(ms);
const reveal = (h) => (h.ctx.__mercReveal ? h.ctx.__mercReveal() : { count: -1, log: [] });

test("always open: an empty week still plays (HUD + blob, no gather gate)", () => {
  const h = settle(boot({ kid: "hayes" }));
  assert.match(h.ui.innerHTML, /class="hud"/, "the run HUD is up with zero filled days");
  assert.doesNotMatch(h.ui.innerHTML, /class="gather/, "no full-jar gather gate");
  assert.equal(h.debug().playing, true);
});

test("always open: the kid board's Step into the run link no longer waits for a full jar", () => {
  const kw = rd("kid-world.js");
  const mount = kw.slice(kw.indexOf("function mountJar"), kw.indexOf("function mountJar") + 4000);
  assert.ok(mount.includes("Step into the run"), "the run link lives in mountJar");
  assert.doesNotMatch(mount, /if \(!st\.full\) return;/, "no full-jar early return before the link");
});

test("always open: a full jar is the finale, not the entry ticket", () => {
  const h = boot({ kid: "hayes" }); h.fullWeek("hayes"); settle(h);
  assert.equal(h.debug().finale, true);
  const e = settle(boot({ kid: "hayes" }));
  assert.equal(e.debug().finale, false);
});

test("single player: one blob by default; a touch anywhere jumps on touch-down", () => {
  const h = settle(boot({ kid: "hayes", w: 390, h: 844 }), 900);
  assert.equal(h.merc().length, 1, "one kid, one blob");
  assert.equal(h.merc()[0].grounded, true);
  h.pointer("pointerdown", 370, 600).advance(32);       /* far right: was the third sibling's zone */
  assert.ok(h.merc()[0].vy < 0, "A is rising before the finger lifts (vy " + h.merc()[0].vy + ")");
  h.pointer("pointerup", 370, 600);
});

test("single player: ?coop=2 brings back two zones; the right half drives the second blob", () => {
  const h = settle(boot({ kid: "hayes", coop: "2" }), 900);
  assert.equal(h.merc().length, 2);
  h.pointer("pointerdown", 460, 200).advance(32);
  const m = h.merc();
  assert.ok(m[1].vy < 0, "B jumps from its own zone");
  assert.equal(m[0].vy, 0, "A stays put");
});

test("landing: a full week (7 filled days) blob lands, grows upward and never falls through", () => {
  const h = boot({ kid: "hayes" }); h.fullWeek("hayes"); settle(h, 10000);
  const b = h.merc()[0];
  assert.equal(b.days, 7);
  assert.ok(Math.abs(b.r - R0 * (1 + 0.14 * 7)) < 0.6, "grown to 7 steps (r " + b.r + ")");
  assert.equal(b.grounded, true, "resting on the first platform");
  assert.deepEqual(J(h.debug().gathers), [], "no fall / gather loop");
  h.pointer("pointerdown", 240, 200).advance(32);
  assert.ok(h.merc()[0].vy < 0, "a big blob can still jump");
});

test("landing: 7 filled days without the weeklies (not full) still stands", () => {
  const h = boot({ kid: "hayes", checks: fullDays("hayes", TAPS) }); settle(h, 9000);
  assert.equal(h.merc()[0].days, 7);
  assert.equal(h.merc()[0].grounded, true);
  assert.deepEqual(J(h.debug().gathers), []);
});

test("growth step: enters at base size, then animates a visible step per filled day", () => {
  const h = boot({ kid: "ainsley", checks: fullDays("ainsley", [TAPS[0]]) }); settle(h, 150);
  assert.ok(Math.abs(h.merc()[0].r - R0) < 0.5, "starts at the base radius (r " + h.merc()[0].r + ")");
  h.advance(2500);
  const r1 = h.merc()[0].r;
  assert.ok(r1 - R0 >= 0.12 * R0, "one day is a step you can see: +" + (r1 - R0).toFixed(1) + " px on " + R0);
});

test("growth step: the jar shader scales the creature by uFill (kid boards: 86% empty, 100% full)", () => {
  const src = rd("jar-engine.js");
  assert.match(src, /float fs=FILL_LO\+\(1\.0-FILL_LO\)\*clamp\(uFill,0\.0,1\.0\)/);
  const h = boot({ kid: "hayes" });
  assert.equal(h.ctx.JarEngine.fillScale(0), 0.86);
  assert.equal(h.ctx.JarEngine.fillScale(1), 1);
  assert.ok(Math.abs(h.ctx.JarEngine.fillScale(0.5) - 0.93) < 1e-9);
});

for (const n of [0, 2, 5]) {
  test("reveal: " + n + " filled day(s) = " + n + " pebble glow / growth step / chime", () => {
    const h = boot({ kid: "ainsley", checks: fullDays("ainsley", TAPS.slice(0, n)) }); settle(h, 6000);
    const rv = reveal(h);
    assert.equal(rv.count, n, "reveal steps");
    assert.equal(h.log.chimes, n, "HouseSfx chimes");
    assert.equal(h.merc()[0].lit, n, "lit pebbles");
    assert.deepEqual(J(rv.log.map((x) => x[1])), Array.from({ length: n }, (_, i) => i + 1));
  });
}

test("reveal: re-entry data (focus) after a new tap adds exactly one more step", () => {
  const h = boot({ kid: "ainsley", checks: fullDays("ainsley", TAPS.slice(0, 2)) }); settle(h, 4000);
  ["ain-bed", "ain-toys", "ain-dishwasher", "ain-empty", "ain-living"].forEach((id) => h.tick(id, TAPS[2]));
  h.fire("focus", "win"); h.advance(2000);
  assert.equal(reveal(h).count, 3);
  assert.equal(h.merc()[0].days, 3);
});

/* kids-data's chore week turns over Friday 3:00 PM CT (HAYESJAR1C). The run must follow "today" live, not the day it loaded on. */
test("today is live: Tue 23:30 to Wed 00:01, today's double jump follows the new day", () => {
  const h = boot({ kid: "ainsley", at: FX.clock.tue2330, checks: fullDays("ainsley", ["2026-10-27"]) }); settle(h, 3000);
  assert.equal(J(h.debug().pw)[0][1].dbl, true, "Tuesday's musts are all closed: double jump on");
  h.setWall(FX.clock.wed0001); h.fire("visibilitychange"); h.advance(1500);
  assert.equal(J(h.debug().pw)[0][1].dbl, false, "Wednesday 00:01: nothing closed yet today (was frozen at page load)");
  assert.equal(h.merc()[0].days, 1, "Tuesday still counts in the week");
});

test("today is live: Fri 2:59 PM to 3:00 PM rolls into the new chore week", () => {
  const h = boot({ kid: "ainsley", at: FX.clock.fri1459, checks: fullDays("ainsley", TAPS.slice(0, 5)) }); settle(h, 5000);
  assert.equal(h.merc()[0].days, 5);
  h.setWall(FX.clock.fri1500); h.fire("focus", "win"); h.advance(1500);
  assert.equal(h.merc()[0].days, 0, "the new week starts empty");
  assert.equal(h.merc()[0].lit, 0, "pebbles reset with no fanfare");
});

test("jar engine: choreState() with no opts is unchanged; opts.dayIso reads that day's week", () => {
  const h = boot({ kid: "ainsley", at: FX.clock.wed0700, checks: fullDays("ainsley", TAPS.slice(0, 2)) });
  const JE = h.ctx.JarEngine;
  const a = JSON.stringify(JE.choreState("ainsley"));
  const b = JSON.stringify(JE.choreState("ainsley", { dayIso: h.ctx.WardKids.DAY_ISO }));
  assert.equal(a, b, "same as passing the page-load day");
  const next = JE.choreState("ainsley", { dayIso: "2026-11-02" });
  assert.notEqual(JSON.stringify(next), a, "next week reads next week's (empty) days");
  assert.equal(next.full, false);
});

test("no '$' and no em dash in any kid-facing run copy (empty, partial, full)", () => {
  for (const [kid, setup] of [["hayes", (h) => h], ["ainsley", (h) => { ["ain-bed", "ain-toys", "ain-dishwasher", "ain-empty", "ain-living"].forEach((id) => h.tick(id, TAPS[0])); }], ["hayes", (h) => h.fullWeek("hayes")], ["harris", (h) => h]]) {
    for (const coop of [null, "2"]) {
      const h = boot({ kid, coop }); setup(h); settle(h, 6000);
      const t = h.texts();
      assert.ok(t.length > 40, "copy rendered");
      assert.doesNotMatch(t, /\$/, kid + " copy has a dollar sign");
      assert.doesNotMatch(t, /\u2014/, kid + " copy has an em dash");
    }
  }
  /* the source strings the run can show (hint / note / win) */
  const src = rd("mercury-run.js");
  const lits = [...src.matchAll(/(?:hint|note|merc-win|merc-note)[^\n]*?"([^"]*[A-Za-z]{3}[^"]*)"/g)].map((m) => m[1]);
  lits.forEach((s) => { assert.doesNotMatch(s, /\$|\u2014/, s); });
});

test("one house-face-law.js on the run page; chip off the play area", () => {
  const html = rd("mercury-run.html");
  assert.equal((html.match(/house-face-law\.js/g) || []).length, 1);
  const css = rd("mercury-run.css");
  assert.match(css, /\.pf-flag\.pf-flag--pair[^{]*\{[^}]*bottom:\s*max\(8px[^;]*!important/);
  assert.match(css, /\[data-pair-why\][^{]*\{[^}]*display:\s*none\s*!important/);
});

test("HUD jar gets the run sky (setEnv), Phase 2 art slots exist and default empty", () => {
  const h = boot({ kid: "hayes" }); settle(h);
  assert.match(h.ui.innerHTML, /id="je"/, "a jar creature in the HUD");
  assert.match(rd("mercury-run.js"), /hudJar\.setEnv\(runPlates\.sky\)/);
  const slots = h.ctx.MercuryRun.artSlots();
  assert.deepEqual([...slots].sort(), ["pebble.off", "pebble.on"], "pebble slots; hero + finale moved to the monthly skin");
});

test("blob default tint: Ainsley's fallback blob is rose gold, the boys keep silver", () => {
  assert.equal(settle(boot({ kid: "ainsley" })).merc()[0].tint, "#f6c9b4");
  assert.equal(settle(boot({ kid: "hayes" })).merc()[0].tint, "#d7dde6");
});

test("liquid chrome path still paints (one run with the per-pixel metal on)", () => {
  const h = settle(boot({ kid: "ainsley", liquid: true, w: 240, h: 160 }), 200);
  assert.ok(h.log.put.length > 0);
});

/* ---- SKIN1 · monthly hero skins (Dan via Atlas 10/27 6:45 + 6:46 PM) ---- */
const FIXBOOK = { "2026-11": { id: "turkey", dir: FIXDIR, from: { civil: "2026-11-01", hour: 6 } } };
const skinAt = async (at, extra = {}) => { const h = boot(Object.assign({ kid: "hayes", at, skinRoot: SKINROOT }, extra)); await h.flush(); settle(h, 300); await h.flush(); return h; };

test("skin pick: Oct is the pumpkin; Nov 1 5:59 AM CT is still Oct; 6:00 AM CT is the turkey", async () => {
  assert.equal((await skinAt(FX.clock.wed0700)).skin().id, "pumpkin");
  assert.equal((await skinAt("2026-11-01T11:59:00Z")).skin().month, "2026-10", "5:59 AM CST Nov 1");
  assert.equal((await skinAt("2026-11-01T12:00:00Z")).skin().month, "2026-11", "6:00 AM CST Nov 1");
  assert.equal((await skinAt("2026-11-01T12:00:00Z")).skin().id, "turkey");
  assert.equal((await skinAt("2026-11-30T23:00:00Z")).skin().id, "turkey");
});

test("skin pick: a run left open across 6 AM Nov 1 changes skin on the next re-read", async () => {
  const h = await skinAt("2026-11-01T11:58:00Z");
  assert.equal(h.skin().month, "2026-10");
  h.setWall("2026-11-01T12:01:00Z"); h.fire("focus", "win"); h.advance(200); await h.flush();
  assert.equal(h.skin().month, "2026-11");
});

test("skin pick: the November start follows AMBIENT1's halloween-dates.json end (same 6 AM boundary)", async () => {
  const h = await skinAt(FX.clock.wed0700);
  assert.ok(h.log.fetches.includes("livinghouse/ambient/halloween-dates.json"));
  const j = JSON.parse(rd("livinghouse/ambient/halloween-dates.json"));
  assert.deepEqual([j.end.civil, j.end.hour], ["2026-11-01", 6]);
});

test("skin override: ?skin= and ?month= win over the date; unknown = the blob", async () => {
  assert.equal((await skinAt(FX.clock.wed0700, { query: "skin=turkey" })).skin().month, "2026-11");
  assert.equal((await skinAt(FX.clock.wed0700, { query: "month=2026-11" })).skin().id, "turkey");
  assert.equal((await skinAt("2026-11-10T12:00:00Z", { query: "skin=pumpkin" })).skin().month, "2026-10");
  const d = (await skinAt(FX.clock.wed0700, { query: "skin=blob" })).skin();
  assert.deepEqual([d.month, d.id, d.hero], ["default", "blob", "blob"]);
  const dec = (await skinAt(FX.clock.wed0700, { query: "month=2026-12" })).skin();
  assert.deepEqual([dec.id, dec.hero], ["blob", "blob"], "a month with no registry line shows the blob");
});

const MISSBOOK = { "2026-11": { id: "turkey", dir: "art/mercury/skins/qa-missing/", from: { civil: "2026-11-01", hour: 6 } } };
test("missing art fails closed to the blob: the pumpkin (no art in the tree yet) and a turkey dir with no files, no sprite drawn", async () => {
  for (const [at, extra] of [[FX.clock.wed0700, {}], ["2026-11-02T13:00:00Z", { skinBook: MISSBOOK }]]) {
    const h = await skinAt(at, extra); h.advance(300);
    const sk = h.skin();
    assert.deepEqual([sk.hero, sk.finale], ["blob", "default"], sk.id);
    assert.equal(h.log.drawn.filter((u) => /^art\/mercury\/skins\//.test(u)).length, 0, "no broken skin image painted");
  }
});

test("skin loader: the Prism p2 layout (fixture PNGs) is worn; per-kid variant; finale optional", async () => {
  const hy = await skinAt("2026-11-02T13:00:00Z", { skinBook: FIXBOOK }); hy.advance(300);
  assert.deepEqual([hy.skin().hero, hy.skin().finale, hy.skin().dir], ["art", "lazy", FIXDIR + "hayes/"], "ORI2: finale not preloaded");
  hy.skin().finaleFor(640, 360); hy.advance(40); await hy.flush();
  assert.deepEqual([hy.skin().finale, hy.skin().finaleFor(640, 360)], ["art", FIXDIR + "hayes/1x/finale.png"], "finale fetched when it shows");
  assert.ok(hy.log.drawn.some((u) => u.startsWith(FIXDIR + "hayes/") && /\/1x\/[a-z0-9-]+\.png$/.test(u)), "hayes sprite drawn");
  assert.ok(hy.log.drawn.some((u) => /\/1x\/eyes-(open|half|closed|happy)\.png$/.test(u)), "eyes layer drawn");
  assert.ok(hy.log.images.every((u) => !/\/(harris|ainsley)\//.test(u)), "only the host kid's variant loads");
  const hr = await skinAt("2026-11-02T13:00:00Z", { kid: "harris", skinBook: FIXBOOK }); hr.advance(300);
  for (let i = 0; i < 3; i++) { hr.skin().finaleFor(640, 360); hr.advance(40); await hr.flush(); }
  assert.deepEqual([hr.skin().hero, hr.skin().finale, hr.skin().finaleFor(640, 360)], ["art", "default", null], "harris: no finale scene = default finale, turkey kept");
  assert.ok(hr.log.drawn.some((u) => u.startsWith(FIXDIR + "harris/")));
  const ai = await skinAt("2026-11-02T13:00:00Z", { kid: "ainsley", skinBook: FIXBOOK }); ai.advance(300);
  assert.equal(ai.skin().hero, "blob", "ainsley's fixture set is missing sleep: the blob, never half a skin");
  assert.equal(ai.log.drawn.filter((u) => u.startsWith(FIXDIR)).length, 0);
  const x2 = await skinAt("2026-11-02T13:00:00Z", { skinBook: FIXBOOK, dpr: 2 }); x2.advance(300);
  assert.ok(x2.log.images.some((u) => /\/2x\/idle\.png$/.test(u)) && x2.skin().scale === 2, "2x sprites on a 2x screen");
});

test("mechanics are identical across skins: same size-from-days, same moves, same finale unlock", async () => {
  const run = async (extra, full) => {
    const h = boot(Object.assign({ kid: "hayes", skinRoot: SKINROOT, at: "2026-11-02T13:00:00Z", checks: fullDays("hayes", ["2026-10-31", "2026-11-01", "2026-11-02"].slice(0, full ? 0 : 3)) }, extra));
    if (full) { h.ctx.WardKids.weekDayIsos(h.ctx.HouseClock.iso(new h.ctx.Date())).forEach((d) => require0(h, d)); }
    await h.flush(); settle(h, 4000);
    h.pointer("pointerdown", 200, 200).advance(200).pointer("pointermove", 260, 200).advance(400).pointer("pointerup", 260, 200).advance(1500);
    return { m: J(h.merc()).map((b) => Object.assign({}, b, { tint: 0 })), fin: h.debug().finale, hero: h.skin().hero };
  };
  const require0 = (h, d) => { [...FX.data.kids.hayes.quests].forEach((q) => h.tick(q.id, d)); };
  const blob = await run({ query: "skin=blob" }), art = await run({ skinBook: FIXBOOK }), miss = await run({ skinBook: MISSBOOK }), real = await run({});
  assert.deepEqual([blob.hero, art.hero, miss.hero, real.hero], ["blob", "art", "blob", "art"], "real = the committed Prism turkey");
  assert.deepEqual(art.m, blob.m, "turkey art vs blob: same x / y / r / days");
  assert.deepEqual(miss.m, blob.m);
  assert.deepEqual(real.m, blob.m, "real turkey art vs blob: same x / y / r / days");
  assert.ok(blob.m[0].days === 3 && blob.m[0].r > 26 * 1.4);
  const fb = await run({ query: "skin=blob" }, true), fa = await run({ skinBook: FIXBOOK }, true);
  assert.equal(fb.fin, true); assert.equal(fa.fin, true, "a full jar unlocks the finale in every skin");
});

test("room left, nothing built: accessory + transition hooks are no-ops today", () => {
  const src = rd("mercury-run.js");
  assert.match(src, /function skinTransition\(from, to\) \{ if \(!to\.def \|\| !to\.def\.transition\) return;/);
  assert.match(src, /function paintAccessory\(g, b, st, sc\) \{ if \(!skin\.def \|\| !skin\.def\.accessory/);
  assert.doesNotMatch(src, /turkey|pumpkin/i.test(src) ? /drawTurkey|paintTurkey|paintPumpkin/ : /$^/, "no code-drawn skin art");
});

test("harness sanity: root " + ROOT.split("/").slice(-2).join("/"), () => { assert.ok(rd("mercury-run.js").length > 1000); });
