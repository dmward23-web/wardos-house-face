/* ORI1 · SKIN1 real November turkey (Prism p2 nov-turkey/early, SUMS sha16 39ab2efbbc152083, Atlas OK 10/27). Static, node:vm,
   no browser. Pins the committed art under art/mercury/skins/2026-11/<kid>/ (Prism <name>@<s>x.png filed as <s>x/<name>.png): every file the loader asks for is present at 1x/2x/3x, every
   anchor parses, the real skin is worn per kid, and paintHero scales the sprite by bodyR (body radius in 1x px) so the art
   body matches the blob radius at every scale. The fixture-based SKIN1 tests stay in ori1.test.mjs. */
import fs from "node:fs";
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

test("real turkey: the registry's 2026-11 entry points at art/mercury/skins/2026-11/", () => {
  const src = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");
  assert.match(src, /"2026-11": \{ id: "turkey", dir: "art\/mercury\/skins\/2026-11\/"/);
});

for (const kid of KIDS) {
  test(`real turkey ${kid}: every state, eye and finale PNG is present at 1x/2x/3x, and only the loader's files`, () => {
    const d = path.join(ROOT, DIR, kid);
    assert.deepEqual(fs.readdirSync(d).sort(), ["1x", "2x", "3x", "anchors.json"]);
    const want = [...STATES, ...EYES.map((e) => `eyes-${e}`), "finale"].map((n) => n + ".png").sort();
    for (const s of [1, 2, 3]) assert.deepEqual(fs.readdirSync(path.join(d, `${s}x`)).sort(), want, `${s}x: 15 PNGs (45 per kid), no webp, no extras`);
    for (const st of STATES) {
      const one = png(path.join(d, "1x", `${st}.png`));
      for (const s of [2, 3]) {
        const big = png(path.join(d, `${s}x`, `${st}.png`));
        assert.ok(Math.abs(big.w - one.w * s) <= s && Math.abs(big.h - one.h * s) <= s, `${s}x/${st} is ${s}x the 1x size`);
      }
    }
  });

  test(`real turkey ${kid}: anchors.json parses; bodyR and every state's contact and eyes are numbers inside the 1x sprite`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, DIR, kid, "anchors.json"), "utf8"));
    assert.ok(typeof j.bodyR === "number" && j.bodyR > 20 && j.bodyR < 200, "top-level bodyR in 1x px");
    for (const st of STATES) {
      const a = j.states[st], im = png(path.join(ROOT, DIR, kid, "1x", `${st}.png`));
      assert.ok(a, st);
      assert.ok(pair(a.contact) && pair(a.eyes), `${st}: contact + eyes`);
      for (const p of [a.contact, a.eyes]) assert.ok(p[0] >= 0 && p[0] <= im.w && p[1] >= 0 && p[1] <= im.h, `${st}: anchor inside ${im.w}x${im.h}`);
      assert.ok(a.eyes[1] < a.contact[1], `${st}: eyes above the contact point`);
    }
    assert.ok("accessory" in j && "eyeSize1x" in j, "Prism's extra keys are kept in the copied JSON (ignored by the loader)");
  });

  for (const dpr of [1, 2, 3]) {
    test(`real turkey ${kid} @${dpr}x: worn on Nov 2 with its finale; paintHero scale = blob r / (bodyR x ${dpr})`, async () => {
      const h = boot({ kid, at: NOV2, dpr });
      const g = h.els.run.getContext("2d"), ev = [];
      g.scale = (x, y) => ev.push({ x, y, at: h.log.drawn.length });
      await h.flush(); h.ready().advance(300); await h.flush(); h.advance(400);
      const sk = h.skin();
      assert.deepEqual([sk.id, sk.month, sk.hero, sk.finale, sk.dir, sk.scale], ["turkey", "2026-11", "art", "art", DIR + kid + "/", dpr]);
      assert.ok(h.log.images.every((u) => !/^art\/mercury\/skins\//.test(u) || u.startsWith(DIR + kid + "/")), "only the host kid's variant loads");
      assert.ok(h.log.images.includes(`${DIR}${kid}/${dpr}x/finale.png`));
      const i = h.log.drawn.findIndex((u) => u.startsWith(DIR + kid + "/") && !/eyes-|finale/.test(u));
      assert.ok(i >= 0, "a real turkey sprite was painted");
      assert.ok(h.log.drawn[i].startsWith(`${DIR}${kid}/${dpr}x/`), h.log.drawn[i]);
      assert.match(h.log.drawn[i + 1] || "", new RegExp(`^${DIR}${kid}/${dpr}x/eyes-(open|half|closed|happy)\\.png$`), "eyes layer right after the body");
      const sc = ev.filter((e) => e.at === i).pop();
      assert.ok(sc, "paintHero set a scale before the sprite");
      const bodyR = JSON.parse(fs.readFileSync(path.join(ROOT, DIR, kid, "anchors.json"), "utf8")).bodyR;
      const r = h.merc()[0].r;
      assert.ok(Math.abs(sc.y - r / (bodyR * dpr)) < 1e-6, `scale ${sc.y} vs r ${r} / (bodyR ${bodyR} x ${dpr})`);
      assert.ok(Math.abs(Math.abs(sc.x) - sc.y) < 1e-9, "uniform scale (x may mirror on a left roll)");
      assert.ok(Math.abs(sc.y * bodyR * dpr - r) < 1e-6, "art body radius on screen == blob radius");
    });
  }
}
