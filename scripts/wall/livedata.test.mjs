// LIVEDATA1 + FORBID-01 + NOJAR-01 + OWN-01 · node scripts/wall/livedata.test.mjs (Atlas 10/2 scope change)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let n = 0; const t = (name, fn) => { fn(); n++; };
const FEEDS = ["house-mode", "next-up", "kid-seats", "unlocks", "pickup-chain", "school-night", "who-home", "logistics-taps"];
t("the 10-minute calendar refresh writes, mirrors and commits all 8 wall feeds (same data-only allowlist)", () => {
  const sh = read("scripts/house-board-calendar-refresh.sh");
  for (const f of FEEDS) assert.ok(sh.includes(`  data/${f}.json`), f + " in ALLOW_WRITE");
  assert.ok(/scripts\/house-feeds-refresh\.sh" --events "\$EVENTS"/.test(sh), "feeds run from the scrubbed dump");
  assert.ok(sh.indexOf("house-feeds-refresh.sh\" --events") > sh.indexOf("cal-from-events.mjs"), "after cal-live");
  assert.ok(sh.indexOf("house-feeds-refresh.sh\" --events") < sh.indexOf("assert_protected_untouched \"$BEFORE_HASH\""), "inside the protect check");
  const feeds = read("scripts/house-feeds-refresh.sh");
  for (const s of ["house-mode.mjs", "next-up.mjs", "kid-layer.mjs", "pickup-chain.mjs", "school-night.mjs", "who-home.mjs", "logistics-taps.mjs"]) assert.ok(feeds.includes("scripts/" + s), s);
  assert.doesNotMatch(feeds.replace(/^#.*$/gm, ""), /\bgit\b|curl|fetch|house-face-deploy/, "no git, no network, no deploy");
  const sched = JSON.parse(read("config/house-feeds.schedule.json"));
  assert.deepEqual(sched.runs.map((r) => r.every || r.at), ["10m", "03:00 America/Chicago"]);
  assert.equal(sched.staleAfterMinutes, 120);
  assert.deepEqual(sched.feeds.map((f) => path.basename(f, ".json")), FEEDS);
});
t("who-home.mjs: today's house day (3 AM reset), earlier check-ins drop, today's stay; --stdout writes nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wh-"));
  const st = path.join(dir, "s.json");
  fs.writeFileSync(st, JSON.stringify({ kids: [{ id: "hayes", checkedInAt: "2026-10-02T07:10:00-05:00" }, { id: "harris", checkedInAt: "2026-10-01T20:00:00-05:00" }] }));
  const out = JSON.parse(execFileSync("node", [path.join(ROOT, "scripts/who-home.mjs"), "--state", st, "--now", "2026-10-02T07:30:00-05:00", "--stdout"], { encoding: "utf8" }));
  assert.equal(out.date, "2026-10-02"); assert.equal(out.resetsAt, "2026-10-03T03:00:00-05:00");
  assert.equal(out.kids.find((k) => k.id === "hayes").checkedInAt, "2026-10-02T07:10:00-05:00");
  assert.equal(out.kids.find((k) => k.id === "harris").checkedInAt, null);
  const at2 = JSON.parse(execFileSync("node", [path.join(ROOT, "scripts/who-home.mjs"), "--state", st, "--now", "2026-10-02T02:30:00-05:00", "--stdout"], { encoding: "utf8" }));
  assert.equal(at2.date, "2026-10-01", "before 3 AM it is still yesterday's house day");
});
t("wall: stale dot lights at 2 h for every feed (dim amber class, no motion), header glance, handoff from house-mode, disabled taps say why", () => {
  const w = read("wall.html"), css = read("wall-ion/ion-wright.css");
  assert.ok(/FEED_MAX_MS = 2 \* 60 \* 60 \* 1000/.test(w));
  for (const f of ["feeds.houseMode", "feeds.nextUp", "feeds.kidSeats", "feeds.pickup", "feeds.schoolNight", "feeds.unlocks", "feeds.logistics", "feeds.whoHome"]) assert.ok(w.slice(w.indexOf("function oldFeeds"), w.indexOf("function paintGlance")).includes(f), f);
  assert.ok(/\$\("w-stale"\)\.classList\.toggle\("on", old2h\.length > 0\)/.test(w));
  const dot = css.split("\n").filter((l) => l.includes(".stale-dot.on"));
  assert.ok(dot.length && dot.every((l) => /amber-rgb/.test(l) && !/animation|red|--alert/.test(l)));
  assert.ok(/id="w-glance"/.test(w) && /x\.mode === "kids-away"/.test(w) && /"Handoff " \+ ct\(hv\.since\)/.test(w));
  assert.ok(/Off \\\\u00b7 today's taps not in yet/.test(w) || /Off \\u00b7 today's taps not in yet/.test(w));
  assert.ok(/\.tap\.big\.is-off \{ opacity: 0\.42/.test(css));
});
t("FORBID-01: desk gate has no Autopay, Bills, mail drafts, Vita mind; no 'Harbor drafts' anywhere served; no allowance text on sheet-status", () => {
  const dg = read("sheet-desk-gate.html").replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(dg, /auto-?pay|\bbills?\b|\bdrafts?\b|Vita|Harbor/i);
  for (const f of fs.readdirSync(ROOT).filter((f) => /\.(html|js)$/.test(f))) assert.doesNotMatch(read(f).replace(/<!--[\s\S]*?-->/g, ""), /Harbor drafts/i, f);
  assert.doesNotMatch(read("sheet-status.html"), /allowance/i);
});
t("NOJAR-01 + CL-03: no 'allowance-phone' card on the gallery; no stars on Ainsley's chores column", () => {
  const g = read("sheet-gallery.html").replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(g, /allowance/i);
  const c = read("sheet-chores.html"), a = c.slice(c.indexOf('aria-label="Ainsley chores"'), c.indexOf('aria-label="Hayes chores"'));
  assert.doesNotMatch(a.replace(/\$15\/hr/, ""), /★|data-stars="[1-9]/);
});
t("OWN-01: every rail badge and seat carries data-owner + the locked tile id", () => {
  const w = read("wall.html");
  const want = { today: "Atlas", week: "Atlas", month: "Atlas", countdowns: "Atlas", "dad-seat": "Atlas", "us-together": "Atlas", pack: "Atlas", "weekend-fun": "Atlas", "week-win": "Atlas",
    "groceries-costco": "Ledger", "dinner-vote": "Vita", gallery: "Prism", "need-photo": "Prism", "load-day": "Wright", "google-home": "Wright", status: "Wright", harris: "Atlas", hayes: "Atlas", ainsley: "Atlas" };
  for (const [id, ow] of Object.entries(want)) assert.ok(new RegExp(`data-owner="${ow}"[^>]*data-tile="${id}"`).test(w), id);
  const badges = w.match(/<a [^>]*class="badge [^>]*>/g) || [];
  assert.equal(badges.length, 16); for (const b of badges) assert.ok(/data-owner="\w+"/.test(b), b);
});
{
  const { createRequire } = await import("node:module");
  const S = createRequire(import.meta.url)(path.join(ROOT, "house-wall-status.js"));
  const N = createRequire(import.meta.url)(path.join(ROOT, "house-noagent.js"));
  t("INV-01: open loops = today's calendar REMIND / GET items (agents, money, people filtered); none -> the row collapses", () => {
    const now = Date.parse("2026-10-02T07:30:00-05:00");
    const cal = { fetchedAt: "2026-10-02T12:20:00Z", upcomingLeaves: [
      { summary: "REMIND · donation receipts → Ledger (Erin list + Goodwill)", start: "2026-10-02T10:20:00-05:00" },
      { summary: "GET · HVAC filter (20x25)", start: "2026-10-02T12:00:00-05:00" },
      { summary: "Dan — get porch bulbs", start: "2026-10-02T13:00:00-05:00" },
      { summary: "Dan — get tree-trim bids (2–3 written)", start: "2026-10-02T12:00:00-05:00" },
      { summary: "GET · tomorrow thing", start: "2026-10-03T12:00:00-05:00" },
      { summary: "Hayes — SRE field trip", start: "2026-10-02T09:00:00-05:00" }] };
    const clean = (x) => (N.clean ? N.clean(x) : (globalThis.HouseNoAgent || {}).clean(x));
    const got = S.openLoops(S.calLoops(cal, { now, clean }), { now }).map((l) => l.text);
    assert.deepEqual(got, ["Get HVAC filter (20x25)", "Get porch bulbs"]);
    assert.deepEqual(S.openLoops(S.calLoops({ fetchedAt: cal.fetchedAt, upcomingLeaves: [] }, { now }), { now }), []);
    const w = read("wall.html");
    assert.ok(/S\.calLoops\(feeds\.cal/.test(w) && /\$\("w-loops"\)\.hidden = !\(loops && loops\.length\)/.test(w));
    assert.doesNotMatch(w, /openLoops\(\[\]/);
  });
}
console.log(`livedata: ${n} tests PASS`);
