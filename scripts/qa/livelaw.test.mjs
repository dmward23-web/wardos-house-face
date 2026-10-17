/* LIVELAW1 · node --test scripts/qa/livelaw.test.mjs
   house-face-law.js on fixtures only (no real data written):
   1. Elm colour days and dress-up / spirit days never stay as kid rows; the colour still reaches the specials rotation.
   2. Rows that already ended today drop; NEXT (hottest) moves to the next real item; nothing is invented.
   3. Face text has no em dashes or arrows. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
function law(nowIso) {
  const fixed = Date.parse(nowIso);
  class FDate extends Date { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }
  const ctx = vm.createContext({ Date: FDate, Intl, console, Math, String, Number, Object, Array, RegExp, JSON });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-face-law.js"), "utf8"), ctx);
  return ctx.HouseFaceLaw;
}
const week = () => ({
  kids: {
    hayes: {
      hottest: { when: "FRI · 12:00", what: "ELM CHAT & CHEW LUNCH", where: "with Dad @ home", badges: ["FRI", "12:00"] },
      today: [
        { when: "Fri · All day", what: "Elm Orange Day" },
        { when: "Fri · All day", what: "Elm Fall Family Fun Night MOVED → Oct 30 Abraca-Boo" },
        { when: "Fri · 12:00", what: "Elm Chat & Chew lunch" },
      ],
      school: [
        { when: "Fri 16 · All day", what: "Elm Orange Day" },
        { when: "Fri 16 · 12:00", what: "Elm Chat & Chew lunch" },
        { when: "Mon 19 · 7:00", what: "Elm specials: PE (tennis shoes)" },
        { when: "Wed 21 · All day", what: "Elm spirit day: Crazy Socks Day (Peace Week)" },
      ],
      sports: [{ when: "Sat 17 · 4:45", what: "Hayes flag — Elm Falcons vs Pena · 5:15–6:15" }],
    },
    ainsley: {
      hottest: { when: "TUE · All day", what: "OAK OUTSIDERS DAY (GREASER OR SOC DRESS-UP)", where: "", badges: ["TUE", "All day"] },
      school: [
        { when: "Tue 20 · All day", what: "OAK Outsiders Day (Greaser or Soc dress-up)" },
        { when: "Wed 21 · All day", what: "OAK fall conferences" },
      ],
      appointments: [{ when: "Mon 19 · 3:00", what: "Dentist appt" }],
    },
  },
  boardStrip: { queue: [{ summary: "Hayes + Harris — Elm Red Day", allDay: true }, { summary: "Hayes + Harris — Elm drop-off · 8:25" }] },
});

test("colour and dress-up/spirit days are recognised; ordinary rows are not", () => {
  const L = law("2026-10-16T20:08:00-05:00");
  for (const t of ["Elm Orange Day", "Hayes + Harris — Elm Red Day", "OAK OUTSIDERS DAY (GREASER OR SOC DRESS-UP)", "Elm spirit day: Hat Day", "Pajama Day", "Wear your jersey", "Halloween costume parade"]) assert.ok(L.isDressDay(t), t);
  for (const t of ["Elm specials: PE (tennis shoes)", "Harris flag — vs ASC (home)", "OAK fall conferences", "Elm Fall Family Fun Night MOVED → Oct 30", "Ward Kids [AHH No School]", "Red Ribbon Week assembly", "Field trip"]) assert.ok(!L.isDressDay(t), t);
});

test("8:08 PM Friday: colour/dress-up rows and ended rows are gone, NEXT moves to the next real item", () => {
  const L = law("2026-10-16T20:08:00-05:00");
  const w = L.cleanKidsWeek(week());
  const all = (k) => ["today", "school", "sports", "appointments"].flatMap((l) => w.kids[k][l] || []).map((r) => r.what).join(" | ");
  assert.doesNotMatch(all("hayes"), /Orange Day|Crazy Socks|Chat & Chew/, all("hayes"));
  assert.match(all("hayes"), /Fun Night/, "today's all-day note stays (it has not ended)");
  assert.match(all("hayes"), /specials: PE/);
  assert.match(all("hayes"), /Falcons/);
  assert.equal(w.kids.hayes.hottest.what, "HAYES FLAG — ELM FALCONS VS PENA · 5:15–6:15");
  assert.match(w.kids.hayes.hottest.when, /^SAT · 4:45$/);
  assert.equal(w.kids.hayes._lawColorRows.length, 2, "colour rows kept for the quiet specials rotation");
  assert.doesNotMatch(all("ainsley"), /Outsiders/);
  assert.match(w.kids.ainsley.hottest.when, /^MON · 3:00$/);
  assert.equal(w.boardStrip.queue.length, 1);
});

test("8:30 AM Friday: the noon lunch is still upcoming and stays NEXT", () => {
  const L = law("2026-10-16T08:30:00-05:00");
  const w = L.cleanKidsWeek(week());
  assert.equal(w.kids.hayes.hottest.what, "ELM CHAT & CHEW LUNCH");
  assert.ok(w.kids.hayes.today.some((r) => /Chat & Chew/.test(r.what)));
  assert.ok(!w.kids.hayes.today.some((r) => /Orange Day/.test(r.what)));
});

test("ranges end at their end time; ISO events end at endIso", () => {
  const L = law("2026-10-17T18:00:00-05:00");
  assert.equal(L.rowEnded({ when: "Sat · 4:45", what: "flag 5:15–6:15" }), false);
  const L2 = law("2026-10-17T18:20:00-05:00");
  assert.equal(L2.rowEnded({ when: "Sat · 4:45", what: "flag 5:15–6:15" }), true);
  assert.equal(L2.rowEnded({ startIso: "2026-10-17T19:00:00-05:00", endIso: "2026-10-17T22:00:00-05:00" }), false);
  assert.equal(L2.rowEnded({ startIso: "2026-10-17T08:00:00-05:00", endIso: "2026-10-17T09:00:00-05:00" }), true);
});

test("nothing left = slot removed, never a placeholder", () => {
  const L = law("2026-10-16T20:08:00-05:00");
  const w = L.cleanKidsWeek({ kids: { harris: { hottest: { when: "FRI · All day", what: "ELM ORANGE DAY" }, today: [{ when: "Fri · All day", what: "Elm Orange Day" }] } } });
  assert.equal(w.kids.harris.hottest, undefined);
  assert.equal(w.kids.harris.today.length, 0);
  assert.doesNotMatch(JSON.stringify(w.kids.harris.today), /UNKNOWN|TBD/);
});

test("face text: no em dash, no arrow", () => {
  const L = law("2026-10-16T20:08:00-05:00");
  assert.equal(L.faceDash("Harris flag — vs Owls (home) · game 8:30"), "Harris flag · vs Owls (home) · game 8:30");
  assert.equal(L.faceDash("Sat 10/17 BNA 3:30p→CLE"), "Sat 10/17 BNA 3:30p to CLE");
  assert.equal(L.faceDash("Fun Night MOVED → Oct 30"), "Fun Night moved to Oct 30");
  assert.equal(L.faceDash("—"), "");
});
