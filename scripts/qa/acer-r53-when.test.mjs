/* N1. The when field is a time allowlist. Synthetic tokens only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const bit = (...p) => p.join("");
const START = "2026-11-16T19:00:00-06:00";
const ROUTES = [
  "/sheet-index.html", "/index.html", "/month.html", "/month-chat.html",
  "/kid-ainsley.html", "/kid-hayes.html", "/kid-harris.html", "/sheet-today.html",
  "/sheet-allowance.html", "/sheet-weekend.html", "/sheet-load-day.html",
  "/sheet-countdowns.html", "/sheet-dan.html", "/sheet-chores.html"
];
const HEALTH = bit("Opt", "ometrist 4pm");
const LEGAL = bit("Law", "yer call");
const MONEY = bit("Child ", "support due");
const PAY = bit("Ven", "mo note");
const BOY = bit("Harr", "is ") + bit("orth", "o");
const FOLD = bit("H4", " yes ") + bit("allerg", "ist");
const BANNED = ["Opt", "ometrist", "Law", "yer", "support", "Ven", "orth", "allerg", "Harr", "H4"];

function boot(pathname) {
  const ctx = {
    Intl, Date, decodeURIComponent, WeakSet,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} }, addEventListener() {} },
    location: { pathname: pathname }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-event-display.js"), ctx);
  vm.runInContext(read("house-face-law.js"), ctx);
  return ctx;
}

function row(when) {
  return { summary: "Soccer", what: "Soccer", title: "Soccer", when: when, start: START, startIso: START, end: "2026-11-16T20:00:00-06:00" };
}

function feed() {
  const rows = [row(HEALTH), row(LEGAL), row(MONEY), row(PAY), row(BOY), row(FOLD), row("10:30 PM"), row("3:00-4:00 PM")];
  return {
    kids: { ainsley: { today: rows, hottest: row(HEALTH) }, hayes: { today: rows }, harris: { today: rows } },
    upcomingLeaves: rows,
    days: { "2026-11-16": { items: rows } }
  };
}

function timeShape(s) {
  return s === "" || s === "All day" || /^\d{1,2}:\d{2}( [AP]M)?$/.test(s) || /^\d{1,2}:\d{2}( [AP]M)?–\d{1,2}:\d{2}( [AP]M)?$/.test(s);
}

test("r53 N1 when is only a time on every locked route and on the kid cards", () => {
  const engage = read("house-kid-engage.js");
  assert.match(engage, /esc\(hot\.when \|\| ""\)/);
  assert.match(engage, /esc\(row\.when \|\| ""\)/);
  for (const pathname of ROUTES) {
    const L = boot(pathname).HouseFaceLaw;
    for (const name of ["kids-week", "cal-live", "cal-months"]) {
      const cleaned = L.cleanFeed(name, feed());
      const blob = JSON.stringify(cleaned);
      for (const word of BANNED) assert.equal(blob.includes(word), false, pathname + " " + name + " " + word + " " + blob.slice(0, 400));
      const leaves = cleaned.upcomingLeaves || [];
      for (const item of leaves) assert.equal(timeShape(item.when || ""), true, pathname + " when " + item.when);
      const kid = cleaned.kids && cleaned.kids.ainsley;
      if (kid) {
        const hot = kid.hottest || {};
        const card = (hot.when || "") + " " + ((kid.today || [])[0] && kid.today[0].when || "");
        for (const word of BANNED) assert.equal(card.includes(word), false, pathname + " card " + card);
        assert.equal(timeShape(hot.when || ""), true, "hottest " + hot.when);
      }
    }
  }
  const plain = (when) => ({ summary: "Soccer", what: "Soccer", title: "Soccer", when: when });
  const kept = boot("/sheet-index.html").HouseFaceLaw.cleanFeed("cal-live", { upcomingLeaves: [plain("10:30 PM"), plain("3:00-4:00 PM")] });
  const whens = kept.upcomingLeaves.map((item) => item.when);
  assert.ok(whens.some((w) => w === "10:30 PM"), JSON.stringify(whens));
  assert.ok(whens.some((w) => /3:00/.test(w) && /4:00/.test(w)), JSON.stringify(whens));
});

test("r53 N9 load day hides rows when the display script is missing", () => {
  const html = read("sheet-load-day.html");
  assert.match(html, /if\(!\(Disp&&Disp\.summarize\)\)rows=\[\]/);
  assert.equal(html.includes("if(Disp&&Disp.summarize)rows=rows.map"), false);
});
