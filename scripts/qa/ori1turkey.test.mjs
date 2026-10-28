/* ORI2 · SKIN1 real November turkey, Prism p2 nov-turkey/photoreal-r2 (SUMS sha16 5dbc561efdf7e165, 345 entries; Atlas OK
   10/27). Replaces the ORI1 early set. Static, node:vm, no browser. Pins the committed art under
   art/mercury/skins/2026-11/<kid>/<s>x/<name>.png (r2 ships that layout, no at-sign names): every file the loader asks for
   is present at 1x/2x/3x, every anchor parses (Ainsley's redrawn roll-2 anchors pinned), the real skin is worn per kid,
   paintHero scales the sprite by bodyR (body radius in 1x px) so the art body matches the blob radius at every scale,
   the portrait finale is picked on a tall view, and the carried-but-unwired text plates + Fredoka font and the future
   extras/ layer never gate the base set. The fixture-based SKIN1 tests stay in ori1.test.mjs. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ROOT } from "./ori1-harness.mjs";

const KIDS = ["hayes", "harris", "ainsley"];
const STATES = ["idle", "squash", "stretch", "fall", "roll-1", "roll-2", "happy", "sleep", "peek", "full"];
const EYES = ["open", "half", "closed", "happy"];
const DIR = "art/mercury/skins/2026-11/";
const NOV2 = "2026-11-02T13:00:00Z";
const png = (f) => { const b = fs.readFileSync(f); assert.equal(b.slice(1, 4).toString(), "PNG", f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));
const anchors = (kid) => JSON.parse(fs.readFileSync(path.join(ROOT, DIR, kid, "anchors.json"), "utf8"));
async function worn(kid, dpr, extra = {}) {
  const h = boot(Object.assign({ kid, at: NOV2, dpr }, extra));
  await h.flush(); h.ready().advance(300); await h.flush(); h.advance(400);
  return h;
}

test("real turkey: the registry's 2026-11 entry points at art/mercury/skins/2026-11/", () => {
  const src = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");
  assert.match(src, /"2026-11": \{ id: "turkey", dir: "art\/mercury\/skins\/2026-11\/"/);
  assert.deepEqual(fs.readdirSync(path.join(ROOT, DIR)).sort(), ["ainsley", "harris", "hayes", "text"], "three kids + the carried text plates; no extras/ yet");
});

for (const kid of KIDS) {
  test(`real turkey r2 ${kid}: every state, eye, finale and portrait finale PNG is present at 1x/2x/3x, and only those`, () => {
    const d = path.join(ROOT, DIR, kid);
    assert.deepEqual(fs.readdirSync(d).sort(), ["1x", "2x", "3x", "anchors.json"]);
    const want = [...STATES, ...EYES.map((e) => `eyes-${e}`), "finale", "finale-portrait"].map((n) => n + ".png").sort();
    for (const s of [1, 2, 3]) assert.deepEqual(fs.readdirSync(path.join(d, `${s}x`)).sort(), want, `${s}x: 16 PNGs (48 per kid), no webp`);
    for (const n of [...STATES, ...EYES.map((e) => `eyes-${e}`), "finale", "finale-portrait"]) {
      const one = png(path.join(d, "1x", `${n}.png`));
      for (const s of [2, 3]) {
        const big = png(path.join(d, `${s}x`, `${n}.png`));
        assert.ok(Math.abs(big.w - one.w * s) <= s + 1 && Math.abs(big.h - one.h * s) <= s + 1, `${s}x/${n} (${big.w}x${big.h}) is ${s}x the 1x size (${one.w}x${one.h})`);
      }
    }
    const f = png(path.join(d, "1x", "finale.png")), p = png(path.join(d, "1x", "finale-portrait.png"));
    assert.ok(f.w > f.h && p.h > p.w, "finale is landscape, finale-portrait is portrait");
  });

  test(`real turkey r2 ${kid}: anchors.json parses; bodyR and every state's contact and eyes are numbers inside the 1x sprite`, () => {
    const j = anchors(kid);
    assert.ok(typeof j.bodyR === "number" && j.bodyR > 20 && j.bodyR < 200, "top-level bodyR in 1x px");
    for (const st of STATES) {
      const a = j.states[st], im = png(path.join(ROOT, DIR, kid, "1x", `${st}.png`));
      assert.ok(a, st);
      assert.ok(pair(a.contact) && pair(a.eyes), `${st}: contact + eyes`);
      for (const p of [a.contact, a.eyes]) assert.ok(p[0] >= 0 && p[0] <= im.w && p[1] >= 0 && p[1] <= im.h, `${st}: anchor inside ${im.w}x${im.h}`);
      assert.ok(a.eyes[1] < a.contact[1], `${st}: eyes above the contact point`);
      assert.ok(pair(a.accessory) && pair(a.feather), `${st}: Prism's per-state accessory + feather kept (ignored by the loader)`);
    }
    assert.ok("accessory" in j && typeof j.eyeSize1x === "number", "Prism's extra top-level keys kept in the copied JSON");
  });

  for (const dpr of [1, 2, 3]) {
    test(`real turkey r2 ${kid} @${dpr}x: worn on Nov 2 with both finales; paintHero scale = blob r / (bodyR x ${dpr})`, async () => {
      const h = boot({ kid, at: NOV2, dpr });
      const g = h.els.run.getContext("2d"), ev = [];
      g.scale = (x, y) => ev.push({ x, y, at: h.log.drawn.length });
      await h.flush(); h.ready().advance(300); await h.flush(); h.advance(400);
      const sk = h.skin();
      assert.deepEqual([sk.id, sk.month, sk.hero, sk.finale, sk.finalePortrait, sk.dir, sk.scale], ["turkey", "2026-11", "art", "art", "art", DIR + kid + "/", dpr]);
      assert.ok(h.log.images.every((u) => !/^art\/mercury\/skins\//.test(u) || u.startsWith(DIR + kid + "/")), "only the host kid's variant loads");
      assert.ok(h.log.images.includes(`${DIR}${kid}/${dpr}x/finale.png`) && h.log.images.includes(`${DIR}${kid}/${dpr}x/finale-portrait.png`));
      assert.equal(sk.finaleFor(390, 844), `${DIR}${kid}/${dpr}x/finale-portrait.png`, "tall phone view: portrait finale");
      assert.equal(sk.finaleFor(1280, 720), `${DIR}${kid}/${dpr}x/finale.png`, "wall / landscape: landscape finale");
      assert.equal(sk.finaleFor(800, 800), `${DIR}${kid}/${dpr}x/finale.png`, "square: landscape finale");
      const i = h.log.drawn.findIndex((u) => u.startsWith(DIR + kid + "/") && !/eyes-|finale/.test(u));
      assert.ok(i >= 0, "a real turkey sprite was painted");
      assert.ok(h.log.drawn[i].startsWith(`${DIR}${kid}/${dpr}x/`), h.log.drawn[i]);
      assert.match(h.log.drawn[i + 1] || "", new RegExp(`^${DIR}${kid}/${dpr}x/eyes-(open|half|closed|happy)\\.png$`), "eyes layer right after the body");
      const sc = ev.filter((e) => e.at === i).pop();
      assert.ok(sc, "paintHero set a scale before the sprite");
      const bodyR = anchors(kid).bodyR, r = h.merc()[0].r;
      assert.ok(Math.abs(sc.y - r / (bodyR * dpr)) < 1e-6, `scale ${sc.y} vs r ${r} / (bodyR ${bodyR} x ${dpr})`);
      assert.ok(Math.abs(Math.abs(sc.x) - sc.y) < 1e-9, "uniform scale (x may mirror on a left roll)");
      assert.ok(Math.abs(sc.y * bodyR * dpr - r) < 1e-6, "art body radius on screen == blob radius");
    });
  }
}

test("real turkey r2 ainsley: roll-2 is the redrawn frame; its anchors moved (eyes, accessory, feather), contact and bodyR kept", () => {
  const j = anchors("ainsley"), r1 = j.states["roll-1"], r2 = j.states["roll-2"];
  assert.deepEqual(r2.eyes, [208.8, 195.2]);
  assert.deepEqual(r2.accessory, [203.0, 166.0]);
  assert.deepEqual(r2.feather, [187.0, 168.1]);
  assert.deepEqual(r2.contact, [170.7, 318.3], "contact unchanged by r2");
  assert.deepEqual(r2.contact, r1.contact, "both roll frames stand on the same contact point");
  assert.equal(j.bodyR, 108.0); assert.equal(j.eyeSize1x, 54);
  assert.ok(Math.hypot(r2.eyes[0] - r1.eyes[0], r2.eyes[1] - r1.eyes[1]) > 20, "roll-2 eyes sit well apart from roll-1 (distinct frame)");
  for (const s of [1, 2, 3]) {
    const a = fs.readFileSync(path.join(ROOT, DIR, "ainsley", `${s}x`, "roll-1.png")), b = fs.readFileSync(path.join(ROOT, DIR, "ainsley", `${s}x`, "roll-2.png"));
    assert.ok(!a.equals(b), `${s}x: roll-2 is its own drawing, not a copy of roll-1`);
  }
});

test("extras layer (Prism follow-on, not wired): absent, partial or broken extras/ never blocks the base set and is never requested", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ori2-extras-"));
  try {
    for (const kid of KIDS) fs.mkdirSync(path.join(tmp, DIR, "extras", kid, "1x"), { recursive: true });
    fs.writeFileSync(path.join(tmp, DIR, "extras", "hayes", "1x", "shine.png"), "not a png");
    fs.writeFileSync(path.join(tmp, DIR, "extras", "anchors.json"), "{ broken");
    for (const kid of KIDS) {
      for (const skinRoot of [undefined, tmp]) {
        const h = await worn(kid, 1, skinRoot ? { skinRoot } : {});
        assert.deepEqual([h.skin().hero, h.skin().finale], ["art", "art"], `${kid}: base set worn (${skinRoot ? "broken extras/ present" : "no extras/"})`);
        assert.ok(![...h.log.images, ...h.log.fetches].some((u) => /extras\//.test(String(u))), "nothing requests extras/");
      }
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("carried text plates + Fredoka: present, kid-copy clean, same words as the live captions, and not wired", () => {
  const td = path.join(ROOT, DIR, "text"), j = JSON.parse(fs.readFileSync(path.join(td, "text.json"), "utf8"));
  const run = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");
  assert.deepEqual(Object.keys(j.plates).sort(), ["controls", "finale", "grow", "jar-full"]);
  const want = [];
  for (const [name, p] of Object.entries(j.plates)) {
    assert.doesNotMatch(p.text, /\$|\u2014|\u2013/, `${name}: no dollar sign, no em/en dash`);
    assert.doesNotMatch(p.text, /\d|\u2605|\u2606|\u2b50|\bstars?\b|\bpoints?\b/i, `${name}: no counts or stars (Ainsley rule; plates are shared)`);
    assert.ok(run.includes(p.text), `${name}: "${p.text}" is copy the run already shows (nothing invented)`);
    for (const f of ["wall", "phone"]) for (const s of [1, 2, 3]) {
      const im = png(path.join(td, `${s}x`, `${name}-${f}.png`)), d = p[f + "1x"];
      assert.ok(Math.abs(im.w - d[0] * s) <= s + 1 && Math.abs(im.h - d[1] * s) <= s + 1, `${s}x/${name}-${f}: ${im.w}x${im.h} vs ${d} x ${s}`);
      want.push(`${s}x/${name}-${f}.png`);
    }
  }
  for (const s of [1, 2, 3]) assert.equal(fs.readdirSync(path.join(td, `${s}x`)).length, 8, `${s}x: 8 plates, no webp`);
  for (const f of ["Fredoka-SemiBold.woff2", "Fredoka-Variable.woff2"]) assert.equal(fs.readFileSync(path.join(ROOT, "fonts", f)).slice(0, 4).toString(), "wOF2", f);
  assert.match(fs.readFileSync(path.join(ROOT, "fonts", "Fredoka-OFL.txt"), "utf8"), /SIL Open Font License, Version 1\.1/, "OFL travels with the font");
  const web = ["mercury-run.js", "mercury-run.html", "mercury-run.css"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  assert.doesNotMatch(web, /Fredoka|\/text\/|text\.json/, "unwired: no page or loader code (comments aside) reads the plates or the font yet");
});
