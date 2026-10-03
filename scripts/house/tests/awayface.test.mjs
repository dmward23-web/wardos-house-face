/* JARHERO3 · the kids-away face holds while house-mode says kids-away, even when the return is not on the calendar yet
   (until: null on fresh data, Fri Oct 2 evening): "Away week" with no invented back time. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import vm from "node:vm"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
function load() {
  const src = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
  const ls = { getItem: () => null, setItem() {}, removeItem() {} };
  const document = { body: { getAttribute: () => null }, readyState: "complete", querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {}, documentElement: { getAttribute: () => null } };
  const win = { localStorage: ls, document, CustomEvent: function () {}, addEventListener() {}, fetch: () => Promise.reject(new Error("offline")) };
  const ctx = { window: win, localStorage: ls, document, CustomEvent: function () {}, console, Intl, Date, setTimeout, clearTimeout };
  ctx.window.window = ctx.window; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.window.WardKids;
}
const T = Date.parse("2026-10-02T20:30:00-05:00");
test("open-ended kids-away: away face, no back time", () => {
  const W = load(); W._setHouseMode({ mode: "kids-away", since: "2026-10-02T15:00:00-05:00", until: null, timeline: [{ mode: "kids-away", since: "2026-10-02T15:00:00-05:00", until: null }] });
  const st = W.stayNow({}, T); assert.equal(st && st.kind, "away"); assert.equal(st.back, "");
});
test("bounded kids-away: back label from until; before since or after until: not away", () => {
  const W = load(); W._setHouseMode({ timeline: [{ mode: "kids-away", since: "2026-10-02T15:00:00-05:00", until: "2026-10-09T15:00:00-05:00" }] });
  const st = W.stayNow({}, T); assert.equal(st.kind, "away"); assert.match(st.back, /^Fri Oct 9 \u00b7 3:00 PM$/);
  assert.notEqual((W.stayNow({}, Date.parse("2026-10-02T14:00:00-05:00")) || {}).kind, "away");
  assert.notEqual((W.stayNow({}, Date.parse("2026-10-09T16:00:00-05:00")) || {}).kind, "away");
});
