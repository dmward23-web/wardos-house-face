// WALLGUARD1 · node scripts/wall/wall-guards.test.mjs · static + fake-fetch guards for wall.html (branch wall-redesign-1)
// Scenes never touch the thermostat; chore done never writes jar/bank keys; no $-page badges; no jar/$ copy; no camera feed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), "utf8");
const A = require("../../house-wall-actions.js");
const K = require("../../house-wall-kid.js");
const S = require("../../house-wall-status.js");
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const wall = read("wall.html"), hub = read("sheet-index.html"), actions = read("house-wall-actions.js");
/** visible copy: drop comments, <script>, <style>, tags and attributes */
const copy = (h) => h.replace(/<!--[\s\S]*?-->/g, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

await t("scene handlers in wall.html never reference sensi/travel (paintScenes + click block, <=12 lines each)", () => {
  const lines = wall.split("\n");
  const idx = lines.findIndex((l) => /\["home", "leave"\]\.forEach/.test(l));
  const pre = lines.findIndex((l) => /function paintScenes\(/.test(l));
  const end = lines.findIndex((l, i) => i > idx && /function paintTravel\(/.test(l));
  assert.ok(idx > 0 && pre > 0 && end > idx && end - idx <= 12 && idx - pre <= 12, "scene blocks found");
  const win = lines.slice(pre, end).join("\n");
  assert.ok(/act\.scene\(id\)/.test(win));
  assert.doesNotMatch(win, /sensi|travel/i);
});
await t("house-wall-actions scene() body never references sensi/travel", () => {
  const m = actions.match(/function scene\(id\) \{[\s\S]*?\n    \}/);
  assert.ok(m); assert.doesNotMatch(m[0], /sensi|travel|call\(|fetch/i);
});
await t("fake fetch: both scenes with a key -> 0 /api/sensi calls, only setLight", async () => {
  const calls = [], lit = [];
  const act = A.create({ fetch: (u) => { calls.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }); },
    getToken: () => "k", getBase: () => "https://hub.invalid", lights: { canWrite: () => true, setLight: (id, p) => lit.push([id, p.on]) } });
  act.scene("home"); act.scene("leave");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(calls.filter((u) => /\/api\/sensi/.test(u)).length, 0);
  assert.equal(calls.length, 0);
  assert.ok(lit.length > 0);
});
await t("CHORELAW2: wall taps write ONLY house-checkoffs:<kid>:<day|week:Sunday> law ids; never jar / bank / money keys", () => {
  const s = K.memStore(), j = JSON.parse(read("data/kid-seats.json")), NOW = Date.parse("2026-10-01T20:30:00-05:00");
  K.KIDS.forEach((k) => { K.tapMust(s, j, k.id, "must-bed", NOW); K.tapClose(s, j, k.id, NOW); K.checkIn(s, k.id, NOW); });
  const keys = Object.keys(s.dump());
  assert.ok(keys.length > 0);
  keys.forEach((k) => assert.match(k, /^(wardos-wall-whohome|house-checkoffs:(harris|hayes|ainsley):(week:)?\d{4}-\d{2}-\d{2})$/));
  keys.forEach((k) => assert.doesNotMatch(k, /jar|bank|allowance|money/i));
});
await t("wall.html source never touches house-bank / jar book keys; taps ride house-tapsync.js", () => {
  const code = wall.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /house-bank|HouseBank|HouseChores|wardos\.jar\.|house\.jar\.shared/);
  assert.doesNotMatch(read("house-wall-kid.js").replace(/\/\*[\s\S]*?\*\//g, ""), /house-bank|jar/i);
  assert.match(wall, /<script src="house-tapsync\.js"><\/script>/);
});
await t("CHORELAW2: no old quest chart on the wall or the hub kid tiles (one chore copy from kid-seats.json)", () => {
  const code = wall.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /kids-week|kids-data\.js|WardKids|data-kid-quest|data-kid-done|Chore done|mustQuests|data-claim=/);
  assert.match(code, /"kid-seats\.json"/);
  const eng = read("house-kid-engage.js");
  const chores = eng.slice(eng.indexOf('if (face === "chores") {'), eng.indexOf("/* leave */"));
  assert.ok(chores.length > 100);
  assert.doesNotMatch(chores, /mustQuests|kid\.quests|getCheck|data-claim=|todayMustProgress/, "Chores face is the law, not the quest chart");
  assert.match(chores, /data-law-must/); assert.match(chores, /w\.choice\(LAW/);
  const tile = eng.slice(eng.indexOf("function paintTile(root)"), eng.indexOf("function setFace("));
  assert.doesNotMatch(tile, /todayMustProgress|streakDays/, "tile count + run read the law");
  const idx = read("sheet-index.html");
  assert.ok(idx.indexOf('src="house-wall-kid.js') > 0 && idx.indexOf('src="house-wall-kid.js') < idx.indexOf('src="house-kid-engage.js'));
  assert.ok(fs.existsSync(new URL("data/kids-week.json", root)), "quest data is NOT deleted (Atlas retires it at merge)");
  /* the law module decides what the Chores face lists */
  const j = JSON.parse(read("data/kid-seats.json")), m = K.musts(j, K.memStore(), "hayes", Date.parse("2026-10-01T20:30:00-05:00"));
  assert.deepEqual(m.items.map((x) => x.id), j.seats.hayes.musts.map((x) => x.id).slice(0, 4));
});
await t("CHORELAW2: dinner-vote and gallery unlock controls gone; no leaderboard / ranking on the wall", () => {
  assert.deepEqual(Object.keys(K.CONTROL), ["weekend-pick"]);
  const code = wall.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const kids = code.slice(code.indexOf('<div class="kids"'), code.indexOf('id="w-jar"')) + read("house-wall-kid.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(kids, /sheet-dinner\.html|sheet-gallery-hero\.html|data-kid-unlock|leaderboard|\.sort\(/i, "kid seats: no dinner-vote / gallery unlock, no ranking (Vita's dinner rail badge is not a kid control)");
  assert.doesNotMatch(code.slice(code.indexOf("function paintKids")), /\.sort\(/);
  const order = [...wall.matchAll(/id="w-kid-([a-z]+)"/g)].map((x) => x[1]);
  assert.deepEqual(order, ["ainsley", "hayes", "harris"], "fixed seat order in markup, never re-ordered by results");
});
await t("CHORELAW2: Harris's sound is the existing soft house-sfx tap only, on his seat only; no new audio code on the wall", () => {
  const code = wall.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(code, /if \(r\.ok && r\.first && mk === "harris"\) harrisTick\(\);/);
  assert.match(code, /window\.HouseSfx\.tap\(\)/);
  assert.doesNotMatch(code, /AudioContext|createOscillator|HouseSfx\.(quest|clear|goal|celebrate|startAmbient)/);
  assert.match(read("house-sfx.js"), /function sfxTap\(\) \{\s*if \(isMuted\(\)\) return;\s*osc\(720, "square", 0\.03, 0\.002, 0\.04, null\);/, "tap = one 40 ms tick at low gain");
});
await t("wall.html has no badge or link to sheet-allowance, sheet-chores or kid-*.html", () => {
  assert.doesNotMatch(wall, /href="(sheet-allowance|sheet-chores|kid-[a-z]+)\.html"/);
  assert.equal((wall.match(/class="badge/g) || []).length, 17);
});
await t("no $ amounts or 'jar' in wall.html visible copy; no bot names either", () => {
  const c = copy(wall);
  assert.doesNotMatch(c, /\$\s?\d/);
  assert.doesNotMatch(c, /\bjars?\b/i);
  assert.doesNotMatch(c, /\b(Alfred|Atlas|Ledger|Prism|Vita|Harbor|Wright)\b/);
});
await t("no <video>, nest-webrtc or house-nest in wall.html / sheet-index.html", () => {
  for (const h of [wall, hub]) {
    assert.doesNotMatch(h, /<video/i);
    assert.doesNotMatch(h, /nest-webrtc|house-nest\.js|mountHubCamDeck|nest-snaps\//);
  }
});
await t("hub keeps a 1-tap path to wall.html and the key entry button", () => {
  assert.match(hub, /<a class="hub-wall-link" href="wall\.html"/);
  assert.match(hub, /id="hub-key-btn" data-hub-key-entry/);
});
await t("laundry controls expose no Pause (LG has no pause op)", () => {
  const c = S.laundryControls({ status: "live" }, {});
  assert.equal("pause" in c, false);
  assert.doesNotMatch(read("sheet-google-home.html"), /data-laundry-op="pause"/);
});
await t("v2 finish: no motion, hall flash config ships empty, pip parked", () => {
  const css = read("tokens-wall-v2.css");
  assert.match(css, /animation: none !important; transition: none !important/);
  assert.doesNotMatch(css, /@keyframes/);
  assert.deepEqual(JSON.parse(read("config/wall-kid.config.json")).hallFlashLightIds, []);
  assert.match(wall, /id="w-pip"[^>]*data-state="off" hidden/);
});
await t("ALFREDP0-5: hub has no Show me the Money / Jars tile; kid surfaces show no Balance", () => {
  assert.doesNotMatch(hub.replace(/<!--[\s\S]*?-->/g, ""), /Show me the Money|Kids jars on board|class="tile stars"/);
  const kd = read("kids-data.js").replace(/var EMBEDDED = .*\n/, "");
  assert.doesNotMatch(kd, /"Balance \$"|Balance \$" \+/);
  assert.doesNotMatch(read("sheet-allowance.html"), /"Balance \$"\+/);
});
await t("$ allowlist: the ONLY rate tag allowed is Ainsley's babysit $15/hr (Dan, 6:27 PM CT)", () => {
  const files = ["kids-data.js", "sheet-chores.html", "sheet-allowance.html", "kid-ainsley.html", "kid-hayes.html", "kid-harris.html", "sheet-index.html", "wall.html"];
  let hits = 0;
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/var EMBEDDED = /.test(line)) return; // calendar/data snapshot, not render code
      const rates = line.match(/\$\d+(?:\.\d+)?\s*\/\s*hr/g) || [];
      rates.forEach((r) => {
        assert.equal(r, "$15/hr", `${f}:${i + 1} unexpected rate ${r}`);
        assert.match(line, /hire|babysit|addon-tag|earnOpt|ain-babysit/i, `${f}:${i + 1} $15/hr outside the babysit tag`);
        hits++;
      });
    });
  }
  assert.ok(hits >= 3, "the babysit tag is kept (not stripped)");
  assert.doesNotMatch(copy(wall), /\$/, "wall face itself shows no $ at all");
});
await t("timer + grocery never touch the Kasa lights or the flash", () => {
  const code = wall.replace(/<!--[\s\S]*?-->/g, "");
  const tb = code.slice(code.indexOf("FIVE UPGRADES #2"), code.indexOf("FIVE UPGRADES #3"));
  assert.ok(tb.length > 200); assert.doesNotMatch(tb, /setLight|flash\.flash|HouseLights/);
  const gb = code.slice(code.indexOf("FIVE UPGRADES #4"), code.indexOf('document.addEventListener("click", function (e) {\n    var t = e.target.closest ? e.target.closest("[data-sp]'));
  assert.ok(gb.length > 200); assert.doesNotMatch(gb, /setLight|flash\.flash|href=|location\./);
});
await t("grocery tile hosts Ledger's house-grocery-list.js as-is; tile hidden by default; no link out", () => {
  assert.match(wall, /<script src="house-grocery-list\.js"><\/script>/);
  assert.match(wall, /id="w-groc"[^>]*hidden/);
  const tile = wall.slice(wall.indexOf('id="w-groc"'), wall.indexOf("<!-- Ask pip"));
  assert.doesNotMatch(tile, /<a |href=/);
});
await t("doors lamp + doorbell line: hidden, no reader, never a feed or still", () => {
  assert.match(wall, /id="w-doors"[^>]*hidden><\/div>/); assert.match(wall, /id="w-bell"[^>]*hidden><\/div>/);
  assert.doesNotMatch(wall.replace(/<!--[\s\S]*?-->/g, ""), /doors?-live\.json|doorbell[^"\n]*\.json|ring-live/);
});
await t("no hardcoded Mom in wall code or copy (data labels render as given)", () => {
  const mine = ["wall.html", "house-wall-kid.js", "house-wall-panel.js", "house-wall-lists.js", "house-wall-actions.js", "tokens-wall-v2.css", "config/wall-kid.config.json"];
  for (const f of mine) assert.doesNotMatch(read(f), /\bmom\b/i, f);
  // house-wall-status.js keeps "mom" only inside PEOPLE_RE, the open-loops BLOCK filter (it hides such loops; it never prints the word)
  read("house-wall-status.js").split("\n").forEach((l, i) => { if (/\bmom\b/i.test(l)) assert.match(l, /PEOPLE_RE = /, `house-wall-status.js:${i + 1}`); });
});
const KP = await import("./kid-path-copy.mjs");
await t("KIDPATH1 scanner catches every banned form (fixtures) and lets only the one $15/hr tag through", () => {
  const bad = { "a.js": 'el.textContent = ("XP " + tp.done + "/" + tp.need);', "b.html": '<div class="money-chip"><span class="lab">Bal</span> $<span>0</span></div>',
    "c.html": '<a class="tile stars" href="sheet-allowance.html"><div class="tile-label">Show me the Money</div></a>', "d.html": '<div class="tab"><span>Mom week</span></div>',
    "e.html": '<span class="star-earn" data-stars="7">$7 wk</span>', "f.json": '{"title": "Tour Jar", "id": "tour-jar"}', "g.html": '<div class="trip-detail">kids with Mom that week</div>',
    "h.js": 'var s = "Paid $" + paid;', "i.html": '<section aria-label="How jars work"></section>',
    "j.js": 'el.textContent = "\u{1F525} " + streak + "-day streak";', "k.html": '<div class="lbl">Reading streak</div>', "l.json": '{"what": "\u{1F525} ALL musts clear"}',
    "m.html": '<div class="grow-total">$<span data-grow-total>0</span></div>' };
  const rules = { "a.js": "XP", "b.html": "Bal", "c.html": "Show me the Money", "d.html": "Mom", "e.html": "$", "f.json": "jar", "g.html": "Mom", "h.js": "$", "i.html": "jar", "j.js": "streak", "k.html": "streak", "l.json": "\u{1F525}", "m.html": "$" };
  for (const [f, src] of Object.entries(bad)) assert.ok(KP.hits(f, src).some((h) => h.rule === rules[f]), f + " should fail on " + rules[f]);
  const ok = { "a.html": '<span class="star-earn addon-tag" data-stars="0">$15/hr</span>', "b.json": '{"id": "tour-jar", "rateLabel": "$15/hr"}',
    "c.js": 'meter.classList.remove("grow-jar"); root.querySelectorAll("[data-grow-jar-name]"); var $x = 1; /* jar comment */',
    "d.json": '{"streakLabel": "Week 4 \u2014 hold the line"}', "e.html": '<div class="streak"><div class="streak-num">0</div></div>' };
  for (const [f, src] of Object.entries(ok)) assert.deepEqual(KP.hits(f, src), [], f + " is clean (tag / code tokens / comments)");
});
await t("KIDPATH1: kid-path files show no $ except the one $15/hr tag, and no jar / XP / Bal / Show me the Money / Mom wording", () => {
  assert.deepEqual(KP.KID_PATH_FILES, ["house-kid-engage.js", "sheet-index.html", "kid-ainsley.html", "kid-hayes.html", "kid-harris.html", "kids-data.js", "kids-week.json",
    "sheet-chores.html", "sheet-allowance.html", "sheet-pack.html", "sheet-win.html", "sheet-countdowns.html", "sheet-today.html",
    "house-saves.js", "house-sfx.js", "house-checkoffs.js"]);
  assert.deepEqual(KP.BANNED.map((b) => b[0]), ["$", "jar", "XP", "Bal", "Show me the Money", "Mom", "streak", "payday", "\u{1F525}"]);
  const all = KP.KID_PATH_FILES.flatMap((f) => KP.hits(f, read(f)));
  assert.deepEqual(all, [], all.map((h) => `${h.file}:${h.line} [${h.rule}] ${h.text}`).join("\n"));
});
await t("KIDPATH1: Ainsley's $15/hr babysit tag is KEPT (kids-week rateLabel, chores addon tag, allowance feed row, kids-data tag)", () => {
  const kw = JSON.parse(read("kids-week.json"));
  const tags = kw.kids.ainsley.quests.filter((q) => q.rateLabel); assert.equal(tags.length, 1); assert.equal(tags[0].rateLabel, "$15/hr"); assert.equal(tags[0].hire, true);
  assert.match(read("sheet-chores.html"), /data-check="ain-babysit"[\s\S]{0,300}<span class="star-earn addon-tag" data-stars="0">\$15\/hr<\/span>/);
  assert.match(read("sheet-allowance.html"), /<span class="plus">\$15\/hr<\/span> Babysitting hire/);
  assert.match(read("kids-data.js"), /earnOpt\.textContent = "\$15\/hr";/);
  for (const f of ["kids-week.json", "sheet-chores.html", "sheet-allowance.html"]) {
    const dollars = KP.visibleCopy(f, read(f)).filter((v) => v.text.includes("$")).map((v) => v.text);
    assert.ok(dollars.length === 1 && dollars[0].includes("$15/hr"), f + " has exactly one $ string, the tag: " + JSON.stringify(dollars));
  }
});
await t("KIDPATH1: display text only; rate logic + star counts untouched (data-stars, goal need, ids, weeklyAllowance code)", () => {
  const ch = read("sheet-chores.html");
  for (const m of ch.matchAll(/<span class="star-earn" data-stars="(\d+)">(\d+)\u2605( wk)?<\/span>/g)) assert.equal(m[1], m[2], "per-chore star text = the row's own data-stars");
  const kw = JSON.parse(read("kids-week.json"));
  assert.deepEqual([kw.kids.harris.bankGoal.id, kw.kids.hayes.bankGoal.id, kw.kids.ainsley.bankGoal.id], ["gem-jar", "victory-jar", "tour-jar"], "ids are keys, not copy");
  assert.equal(kw.kids.ainsley.goal.need, 20);
  const kd = read("kids-data.js");
  assert.match(kd, /function resetJarCycle/); assert.match(kd, /weeklyAllowance/);
  const emb = JSON.parse(kd.match(/var EMBEDDED = (.*);\n/)[1]);
  assert.deepEqual(emb.kids.ainsley.goal, kw.kids.ainsley.goal, "EMBEDDED fallback mirrors kids-week.json");
});
await t("KIDPATH1: Pack tabs read Kids home / Kids away; Win says Kids away; Win's Fri Oct 2 Nashville item untouched", () => {
  const pk = copy(read("sheet-pack.html")), win = read("sheet-win.html");
  assert.match(pk, /Kids home/); assert.match(pk, /Kids away/); assert.doesNotMatch(pk, /\bMom\b/i);
  assert.match(win, /return Oct 23 \u00b7 Kids away that week/);
  assert.match(win, /<div class="trip-when">Fri Oct 2<br\/>\u2192 Thu Oct 9<\/div>\s*<div>\s*<div class="trip-title">Dan \u00b7 Nashville DRIVE<\/div>\s*<div class="trip-detail">Primary drive OP \u2192 Harbor Cove \u00b7 leave 9:00 after boys drop \u00b7 fly is backup only<\/div>/);
  assert.match(win, /<div class="hero-title">Fri Oct 2 \u00b7 Dan DRIVE \u2192 Nashville<\/div>/);
});
await t("KIDPATH2: Hayes + Harris boards match Ainsley (no money chips, star-count readout, Goal wording); ids + goal math untouched", () => {
  for (const f of ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html"]) assert.doesNotMatch(read(f), /data-bank-balance|data-bank-week-earn/, f + " has no Bal / Week $ chips");
  for (const f of ["kid-hayes.html", "kid-harris.html"]) { /* CHORELAW1: Ainsley's star goal section is gone (no stars) */
    const h = read(f);
    assert.match(h, /<div class="grow-total"><span data-grow-total>0<\/span> \/ <span data-grow-save-need>0<\/span> \u2605<\/div>/);
    assert.match(h, /id="sec-jar"/, "anchor id kept"); assert.match(h, /data-grow-jar-name/); assert.match(h, /WardKids\.resetJarCycle\(/);
  }
  const ks = KP.KID_PATH_FILES.flatMap((f) => KP.visibleCopy(f, read(f))).map((v) => v.text).join("\n");
  assert.doesNotMatch(ks, /streak|\u{1F525}/iu); assert.match(read("house-kid-engage.js"), /"Week " \+ streak/);
  assert.doesNotMatch(copy(wall), /streak|\u{1F525}/iu, "wall face has no streak / fire");
});
await t("WEEKLINK1: Week and Dad Seat open different pages; Week = existing hub (WEEKGONE1), Dad Seat = sheet-dan.html", () => {
  const href = (id) => (wall.match(new RegExp('data-tile-id="' + id + '"[^>]*href="([^"]+)"')) || [])[1];
  const wk = href("rail-week"), dad = href("rail-dad-seat");
  assert.ok(wk && dad); assert.notEqual(wk, dad);
  assert.equal(dad, "sheet-dan.html"); assert.equal(wk, "sheet-index.html");
  assert.ok(fs.existsSync(new URL(wk, root)), "Week target exists (not invented)");
  assert.match(read("index.html"), /WEEKGONE1[^>]*old Week links go to the House hub/);
});
await t("WALLKIT9: Hayes reward line is exactly Atlas's 'Goal with Dad after honest musts' (no Payday) in every copy + our fallback", () => {
  const R = "Goal with Dad after honest musts";
  const emb = JSON.parse(/var EMBEDDED = (\{[\s\S]*?\});/.exec(read("kids-data.js"))[1]);
  for (const [name, w] of [["kids-week.json", JSON.parse(read("kids-week.json"))], ["data/kids-week.json", JSON.parse(read("data/kids-week.json"))], ["kids-data.js EMBEDDED", emb]]) {
    assert.equal(w.kids.hayes.bankGoal.reward, R, name);
    assert.doesNotMatch(String(w.kids.hayes.bankGoal.reward), /payday/i, name);
  }
  const kd = read("kids-data.js").replace(/var EMBEDDED = \{[\s\S]*?\};/, "");
  assert.ok(kd.includes(`: "${R}";`), "data-payday-copy fallback (non-Ainsley) reads Atlas's string");
  assert.ok(!kd.includes("Payday with Dad after honest musts"), "old Payday reward line gone");
});
await t("WALLKIT9: Ainsley has a seat, not a score: no streak/day count in her kids-week copy, engage seat or sheets (dropped, not relabeled)", async () => {
  const { kidCopyText, kidCopyDeep } = await import(new URL("scripts/house/kid-copy.mjs", root).href);
  const vals = (v, out = []) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach((x) => vals(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => vals(x, out)); return out; };
  const COUNT = /\b\d+-day\b|streak|\u{1F525}|\bWeek \d+\b/iu;
  const emb = JSON.parse(/var EMBEDDED = (\{[\s\S]*?\});/.exec(read("kids-data.js"))[1]);
  for (const [name, w] of [["kids-week.json", JSON.parse(read("kids-week.json"))], ["data/kids-week.json", JSON.parse(read("data/kids-week.json"))], ["kids-data.js EMBEDDED", emb]]) {
    assert.equal(w.kids.ainsley.streakLabel, "", `${name}: Ainsley streakLabel dropped`);
    assert.deepEqual(vals(w.kids.ainsley).filter((x) => COUNT.test(x)), [], `${name}: no count on Ainsley's copy`);
    for (const k of ["hayes", "harris"]) assert.match(w.kids[k].streakLabel, /^Week \d+\b/, `${name}: ${k} keeps plain Week wording`);
  }
  /* at the source (Atlas's generator pass), so a refresh can't bring it back */
  assert.equal(kidCopyText("◆ 4-day streak — hold the line", "ainsley"), "hold the line");
  assert.equal(kidCopyText("🔥 6-day fire streak — don't break it", "hayes"), "Week 6 — don't break it");
  assert.equal(kidCopyDeep({ kids: { ainsley: { streakLabel: "◆ 9-day streak" } } }).kids.ainsley.streakLabel, "");
  const eng = read("house-kid-engage.js");
  assert.match(eng, /var SEAT_ONLY = \{ ainsley: true \};/);
  const lines = eng.split("\n");
  lines.forEach((l, i) => { if (/"Week " \+ streak/.test(l)) assert.ok(lines.slice(Math.max(0, i - 6), i + 1).some((x) => /SEAT_ONLY\[kidId\]/.test(x)), `engage:${i + 1} streak count not guarded for a seat`); });
  const chores = read("sheet-chores.html"), col = chores.slice(chores.indexOf('aria-label="Ainsley chores"'), chores.indexOf('class="chore-list"', chores.indexOf('aria-label="Ainsley chores"')));
  assert.doesNotMatch(col, /class="streak"|\d+-day/, "sheet-chores Ainsley header has no day-count chip");
  assert.doesNotMatch(read("kid-ainsley.html"), /\b\d+-day\b|Week \d+\b/, "kid-ainsley.html shows no day count");
});
await t("CHORELAW1: no payday wording anywhere on the kid path (scanner bans it); the only $ is still Ainsley's $15/hr", () => {
  const fx = (s) => KP.BANNED.filter(([, f]) => f(s)).map(([k]) => k);
  assert.deepEqual(fx("Next payday · Fri"), ["payday"]); assert.deepEqual(fx("Pay-day with Dad"), ["payday"]); assert.deepEqual(fx("Next goal day · Fri"), []);
  for (const f of KP.KID_PATH_FILES) assert.deepEqual(KP.hits(f, read(f)), [], f);
  const kd = read("kids-data.js").replace(/var EMBEDDED = \{[\s\S]*?\};/, "");
  for (const old of ["Next payday", "Fri payday", "payday after honest musts", "Goal met · Payday with Dad", "Next Payday ="]) assert.ok(!kd.includes(old), old);
  assert.ok(kd.includes('"Next goal day · "') && kd.includes('"Goal met · show Dad"') && kd.includes('"Friday drop · pick with Dad after honest musts"'));
  const al = read("sheet-allowance.html"); assert.ok(al.includes("Dad checks · pick") && al.includes("goal day turns week ★ into carry (carry survives)."));
  assert.doesNotMatch(al, /payday/i);
  assert.doesNotMatch(read("wall.html").replace(/<script[\s\S]*?<\/script>/g, ""), /data-money/, "no weekly $ total element (superseded by the chore law)");
  for (const f of KP.JAR_FILES) assert.deepEqual(KP.jarHits(f, read(f)), [], f + ": jar copy has no $, payday, balance");
});
await t("CHORELAW1: Ainsley has NO stars and NO counts on her tile/seat/page; slots left for Atlas's trusted-with line", () => {
  const eng = read("house-kid-engage.js");
  assert.match(eng, /function facesFor\(kidId\) \{ return SEAT_ONLY\[kidId\] \? FACES\.filter\(function \(f\) \{ return f !== "stars"; \}\) : FACES; \}/);
  assert.match(eng, /if \(face === "stars" && SEAT_ONLY\[kidId\]\) face = "day";/);
  assert.match(eng, /streakEl\.hidden = !!SEAT_ONLY\[kidId\]; \/\* CHORELAW1/);
  assert.match(eng, /if \(label && SEAT_ONLY\[kidId\]\) \{ label\.textContent = ""; label\.hidden = true; \}/);
  assert.match(eng, /if \(SEAT_ONLY\[kidId\]\) \{ if \(glass && glass\.parentNode\) glass\.parentNode\.removeChild\(glass\); return; \}/);
  assert.match(eng, /musts\.hidden = !!SEAT_ONLY\[kidId\]/); assert.match(eng, /data-kf-trusted hidden/);
  assert.doesNotMatch(eng, /"Today " \+ tp\.done/, "no 'Today n/n' on her seat");
  const sfx = read("house-sfx.js"); assert.match(sfx, /if \(t === "ainsley"\) return ""; \/\* CHORELAW1/); assert.match(sfx, /theme\(\) === "ainsley"\) return; \/\* CHORELAW1/);
  const ka = read("kid-ainsley.html").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(ka, /\u2605|data-progress-meta|data-left-count|id="sec-jar"|data-grow-total|data-bank-life|data-got-it|href="#sec-jar"/, "no stars, counts or star goal on Ainsley's page");
  assert.match(ka, /data-trusted-line="ainsley"[^>]*hidden><\/section>/, "empty slot, no invented copy");
  const wall = read("wall.html"); assert.match(wall, /data-kid-trusted="ainsley">/, "trusted-with renders from Atlas's trustedWith only");
  assert.match(wall, /if \(kid === "ainsley"\) return \(r\.trusted\.length/); assert.match(wall, /if \(kid === "harris"\) html \+= '<div class="law-fill"/);
  for (const f of ["sheet-allowance.html", "sheet-chores.html"]) assert.ok(read(f).includes("Ainsley"), f + " (Ainsley star rows there are a listed gap)");
});
console.log(`wall-guards: ${n} tests PASS`);
