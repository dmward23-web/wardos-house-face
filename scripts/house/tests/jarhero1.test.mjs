/* JARHERO1 guards (Dan 6:05-6:19 PM CT; Atlas data calls; Alfred's Ainsley ruling). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ROOT = new URL("../../../", import.meta.url).pathname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
delete globalThis.HouseKidJar;
require(path.join(ROOT, "house-kid-jar.js"));
const H = globalThis.HouseKidJar;
const UE = require(path.join(ROOT, "house-us-erupt.js"));

const at = (hhmm) => Date.parse("2026-10-05T" + hhmm + ":00-05:00");
const home = (extra = {}) => Object.assign({
  quiet: false,
  seats: { hayes: { musts: [{ id: "a", closed: false }] }, harris: { musts: [{ id: "a", closed: false }] }, ainsley: { musts: [{ id: "a", closed: false }] } },
  close: { opensAt: "2026-10-05T19:00:00-05:00", closesAt: "2026-10-05T21:30:00-05:00" },
  dadSeat: { mode: "day", loops: [] }
}, extra);

test("hunger: 0 with no due data, kids away / quiet, or nothing open today", () => {
  const t = at("20:00");
  assert.equal(H.hungerFor(null, "harris", t, { open: 4, total: 4 }), 0);
  assert.equal(H.hungerFor(home({ quiet: true }), "harris", t, { open: 4, total: 4 }), 0, "kids away");
  assert.equal(H.hungerFor(home({ close: null }), "harris", t, { open: 4, total: 4 }), 0, "no close window = no due data");
  assert.equal(H.hungerFor(home(), "harris", t, { open: 0, total: 4 }), 0, "all closed");
  assert.equal(H.hungerFor(home(), "harris", t, null), 0, "page has no tap data");
});
test("hunger (boys): graded by open share and the clock; 1 past close or when the Dad seat lists a slip", () => {
  const s = home();
  const a = H.hungerFor(s, "hayes", at("15:00"), { open: 4, total: 4 });
  const b = H.hungerFor(s, "hayes", at("20:15"), { open: 4, total: 4 });
  const c = H.hungerFor(s, "hayes", at("20:15"), { open: 1, total: 4 });
  assert.ok(a > 0 && a < b && b < 1, `${a} < ${b} < 1`);
  assert.ok(c < b, "fewer open boxes = less hungry");
  assert.equal(H.hungerFor(s, "hayes", at("21:45"), { open: 1, total: 4 }), 1);
  assert.equal(H.hungerFor(home({ dadSeat: { mode: "overnight", loops: [{ kind: "must", kid: "harris" }] } }), "harris", at("07:00"), { open: 1, total: 4 }), 1);
  for (let m = 0; m <= 24 * 60; m += 7) { const v = H.hungerFor(s, "harris", at("00:00") + m * 60000, { open: 2, total: 4 }); assert.ok(v >= 0 && v <= 1); }
});
test("hunger (Ainsley): binary only, 0 or 1, never in between (Alfred)", () => {
  const s = home();
  for (let m = 0; m <= 24 * 60; m += 5) for (const open of [0, 1, 2, 4]) {
    const v = H.hungerFor(s, "ainsley", at("00:00") + m * 60000, { open, total: 4 });
    assert.ok(v === 0 || v === 1, "got " + v);
  }
  assert.equal(H.hungerFor(s, "ainsley", at("15:00"), { open: 2, total: 4 }), 0, "not due yet");
  assert.equal(H.hungerFor(s, "ainsley", at("19:30"), { open: 2, total: 4 }), 1, "due now");
});
test("Ainsley status jar: two states, a granted unlock only, no digits / % / stars / money in its line", () => {
  assert.equal(H.trustedWord(null), "");
  assert.equal(H.trustedWord({ lit: [] }), "");
  assert.equal(H.trustedWord({ lit: [{ id: "weekend-fun", word: "Weekend fun" }] }), "", "Us together unlock is not hers");
  assert.equal(H.trustedWord({ lit: [{ kid: "harris", word: "Sunday dinner" }] }), "");
  assert.equal(H.trustedWord({ lit: [{ kid: "ainsley", trustedWith: "Sunday dinner" }] }), "Sunday dinner");
  for (const bad of ["3 days", "50%", "\u2605 star", "\u0024 5", "5 of 5"]) assert.equal(H.trustedWord({ lit: [{ kid: "ainsley", word: bad }] }), "", bad);
  const src = code(read("house-kid-jar.js"));
  const mA = src.slice(src.indexOf("function mountAinsley"), src.indexOf("function trustFlagOn"));
  assert.doesNotMatch(mA, /setLevel|level:/, "Ainsley's status vessel never takes a numeric level");
  const states = [...mA.matchAll(/"setState", "([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(states.length >= 2 && states.every((x) => x === "empty" || x === "trusted"), "two states only: " + states);
  assert.match(mA, /variant: "status", state: "empty"/, "mounts EMPTY");
  const jm = read("jar-mercury.js");
  assert.match(jm, /this\.status = this\.kid === "ainsley" && opts\.variant === "status"/);
  assert.match(jm, /if \(this\.status\) return false; \/\* the status variant never takes a numeric level/);
  assert.match(jm, /var trusted = state === "trusted" && u\.length > 0;[^\n]*\n\s*this\.target = trusted \? 1 : null;/, "module: TRUSTED = full, else EMPTY");
  assert.doesNotMatch(mA, /mustWeekFill|mustTodayOpen\(\s*"ainsley"\s*\)\.open\s*\//, "never a count toward a level");
  assert.doesNotMatch(src, /is-(half|partial|some|mid)|data-fill=|fill-(low|mid|high)/, "no intermediate fill class");
  const ka = read("kid-ainsley.html");
  assert.match(ka, /<body data-trust-jar="off"/, "Alfred's flag defaults OFF");
  assert.doesNotMatch(code(ka) + src, /streak|of 5|\bX of\b/i, "no streak or 'of 5' code or text on Ainsley's path");
  assert.doesNotMatch(read("jar-mercury.js"), /streak5|of 5/i, "no Prism streak5 variant lifted");
  const card = ka.slice(ka.indexOf("data-trust-jar-card") - 60, ka.indexOf("</section>", ka.indexOf("data-trust-jar-card")));
  assert.doesNotMatch(card.replace(/<!--[\s\S]*?-->/g, ""), /[0-9%\u2605\u2606\u0024]/, "no digits / % / stars / money in her jar markup or aria");
});
test("own page only: brothers' pages and the wall carry no Ainsley jar state; the wall gets no jar motion", () => {
  for (const [f, kid] of [["kid-hayes.html", "hayes"], ["kid-harris.html", "harris"], ["kid-ainsley.html", "ainsley"]]) {
    const s = read(f);
    const ids = [...s.matchAll(/data-kid-jar="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, [kid], f + " mounts only its own kid's jar");
  }
  for (const f of ["kid-hayes.html", "kid-harris.html", "wall.html"]) {
    const s = read(f);
    assert.doesNotMatch(s, /data-trust-jar|kj-trust|Trusted with:/, f + " never shows Ainsley's jar state");
  }
  const wall = read("wall.html");
  assert.doesNotMatch(wall, /house-kid-jar\.js|house-us-erupt\.js|setHunger|eruptUsTogether/, "wall jars: no fill, no hunger, no erupt");
  const src = code(read("house-kid-jar.js"));
  assert.match(src, /querySelector\('\[data-kid-jar="' \+ kid \+ '"\]'\)/, "boot mounts only body[data-kid]'s slot");
  assert.match(src, /kidOfPage\(\) !== kid/, "boil-over light spill only on the owning kid's page");
  assert.doesNotMatch(src.slice(src.indexOf("function hungerFor"), src.indexOf("function call(")), /textContent|innerHTML|setAttribute|aria/, "hunger adds no text or aria");
});
test("boys' fill and hunger come from real musts / due data, never Ledger's book; no money glyph on the kid jar path", () => {
  const src = code(read("house-kid-jar.js"));
  assert.doesNotMatch(src, /HouseJar\b|house-jar\.js|wallDisplay|parentView|bankGoal|grow-pct|data-grow/);
  assert.match(src, /mustWeekFill/);
  for (const f of ["kid-hayes.html", "kid-harris.html"]) {
    const s = read(f).replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script>[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "");
    assert.doesNotMatch(s, /data-grow-meter|data-grow-total|data-bank-life|bank-count|data-bank-fill[^-]|data-unlock-cta|data-got-it/, f + ": old star-goal jar gone");
    assert.doesNotMatch(s, /house-jar\.js/, f);
  }
  for (const f of ["house-kid-jar.js", "house-kid-hero.css", "jar-mercury.js", "jar-mercury.css", "jar-mercury-tokens.css", "house-us-erupt.js"]) assert.doesNotMatch(read(f), /\u0024/, f + " has no dollar glyph");
});
test("Us together erupt: only Atlas's Us together rule; Ainsley's jar / trusted state never changes it", () => {
  const base = { usTogether: { closes: 10, available: 12, unlockAt: 10, lit: true }, seats: { ainsley: { musts: [] } } };
  const off = { usTogether: { closes: 9, available: 12, unlockAt: 10, lit: false }, seats: { ainsley: { musts: [] } } };
  for (const ain of [undefined, { trustedWith: ["Sunday dinner"] }, { jar: "trusted", level: 1 }, { jar: "empty", level: null }]) {
    const a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(off));
    if (ain) { a.seats.ainsley = Object.assign(a.seats.ainsley, ain); b.seats.ainsley = Object.assign(b.seats.ainsley, ain); a.lit = [{ kid: "ainsley", trustedWith: "Sunday dinner" }]; }
    assert.equal(UE.shouldErupt(a), true); assert.equal(UE.shouldErupt(b), false);
  }
  assert.equal(UE.shouldErupt(null), false); assert.equal(UE.shouldErupt({}), false);
  assert.doesNotMatch(code(read("house-us-erupt.js")), /ainsley|trust|level|HouseKidJar|jar\.|wallDisplay/i, "reads only usTogether.lit");
});
test("JARHERO2: a MUSTS pill tap feeds the boys' jar; the eruption is clipped to the Us together tile", () => {
  const j = code(read("house-kid-jar.js"));
  assert.match(j, /getElementById\("sec-musts"\)/, "watches the MUSTS pills");
  assert.match(j, /c > lastClosed\) \{ call\(jar, "feed"\); sync\(true\)/, "each new closed box: feed + stepped ripple");
  const e = read("house-us-erupt.js"), m = read("jar-mercury.js");
  assert.match(e, /#us-board:has\(> canvas\.jm-erupt\)\{overflow:clip!important\}/, "erupt canvas clipped to the tile");
  assert.match(code(read("house-us-erupt.js")), /eruptUsTogether\(tile, shouldErupt\(d\)\)/, "erupt gets ONE family boolean from the rule (Prism 19:09 API)");
  assert.match(m, /function eruptUsTogether\(tileEl, familyUnlocked, o\)[\s\S]{0,400}familyUnlocked !== true\) return null/, "the module refuses to erupt without the family boolean");
  assert.match(m, /this\.binary = this\.kid === "ainsley"/, "Ainsley's hunger is binary in the module too");
  assert.match(read("house-kid-hero.css"), /\.kj-slot \.kj-jar \{[^}]*pointer-events: auto/, "the jar host takes the touch for perk()");
  for (const f of ["house-kid-jar.js", "jar-mercury.js", "jar-mercury.css", "house-us-erupt.js", "house-kid-hero.css", "kid-ainsley.html"]) assert.doesNotMatch(read(f), /streak/i, f + ": no streak code anywhere");
});
