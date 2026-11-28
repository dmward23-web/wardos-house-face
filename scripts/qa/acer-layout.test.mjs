/* ACERFIX · geometry, solar scene, safe titles, and the local diagnostic snapshot. No network. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function boot(extra = {}) {
  const store = {};
  const document = {
    documentElement: {
      style: { setProperty() {} },
      setAttribute() {},
      getAttribute() { return null; }
    },
    body: { childNodes: [], appendChild() {} },
    readyState: "loading",
    addEventListener() {},
    querySelector() { return null; }
  };
  const ctx = {
    document,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }
    },
    location: { search: extra.search || "" },
    innerWidth: extra.w || 1920,
    innerHeight: extra.h || 1080,
    devicePixelRatio: extra.dpr || 1,
    screen: { width: extra.w || 1920, height: extra.h || 1080, availWidth: extra.w || 1920, availHeight: extra.h || 1080 },
    visualViewport: null,
    addEventListener() {},
    setInterval() { return 1; },
    Date,
    Intl,
    URLSearchParams,
    Image: function Image() {},
    console
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-scene.js") + "\n" + read("house-event-display.js") + "\n" + read("wardos-stage.js"), ctx, { filename: "acer-layout-boot.js" });
  return ctx;
}

function contrast(a, b) {
  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
  };
  const L = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const [x, y] = [L(lin(a)), L(lin(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test("stage scale is one fit of the whole 1920x1080 canvas", () => {
  const native = boot({ w: 1920, h: 1080 });
  assert.equal(native.WardosStage.scaleOf(), 1);
  const fit = boot({ w: 1536, h: 864, dpr: 1.25 });
  assert.equal(fit.WardosStage.scaleOf(), 0.8);
  const portrait = boot({ w: 1080, h: 1920 });
  assert.equal(portrait.WardosStage.scaleOf(), 1080 / 1920);
  assert.equal(native.WardosStage.STAGE_W, 1920);
  assert.equal(native.WardosStage.STAGE_H, 1080);
});

test("Kansas City solar day and night do not use hour literals", () => {
  const ctx = boot();
  const S = ctx.HouseScene;
  const noon = new Date("2026-11-10T12:30:00-06:00");
  const night = new Date("2026-11-10T21:00:00-06:00");
  assert.equal(S.phase(noon), "day");
  assert.equal(S.phase(night), "night");
  assert.equal(S.sunDown(noon), false);
  assert.equal(S.sunDown(night), true);
  assert.equal(S.phase(new Date("2026-06-21T12:00:00-05:00")), "day");
  assert.equal(S.phase(new Date("2026-06-21T02:00:00-05:00")), "night");
  assert.equal(S.phase(new Date("2026-12-21T12:00:00-06:00")), "day");
  assert.equal(S.phase(new Date("2026-12-21T22:00:00-06:00")), "night");
  assert.match(S.plates(noon).hub, /hub-window-day-900x864\.webp$/);
  assert.match(S.plates(night).hub, /hub-window-night-900x864\.webp$/);
  assert.match(S.plates(noon).wall, /wall-morning\.webp$/);
  assert.doesNotMatch(read("house-scene.js"), /h >= 6|h < 16|h < 19/);
  const cell = S.cell();
  assert.ok(Math.abs(cell.lat - 39.1) < 0.05 && Math.abs(cell.lon + 94.6) < 0.05);
});

test("dawn and dusk crossings stay inside a minute and ignore the host zone", () => {
  const ctx = boot();
  const S = ctx.HouseScene;
  function cross(day, rising) {
    let lo = Date.parse(day + "T00:00:00-06:00");
    let hi = Date.parse(day + "T23:59:00-06:00");
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const up = S.elevation(new Date(mid)) >= S.DAY_ELEV;
      if (rising ? up : !up) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  }
  const rise = cross("2026-11-10", true);
  const set = cross("2026-11-10", false);
  assert.ok(S.elevation(new Date(rise - 60000)) < S.DAY_ELEV);
  assert.ok(S.elevation(new Date(rise + 60000)) >= S.DAY_ELEV);
  assert.ok(S.elevation(new Date(set - 60000)) >= S.DAY_ELEV);
  assert.ok(S.elevation(new Date(set + 60000)) < S.DAY_ELEV);
  const dusk = new Date("2026-11-08T17:30:00-06:00");
  assert.equal(S.phase(dusk), "dusk");
  assert.equal(S.phase(new Date("2026-11-08T21:00:00-06:00")), "night");
});

test("pinned display clock does not require the browser zone", () => {
  const ctx = boot({ search: "?now=2026-11-10T12:30:00-06:00&freeze=1" });
  assert.equal(ctx.HouseScene.phase(ctx.HouseScene.now()), "day");
  assert.equal(ctx.HouseScene.pinned(), true);
  const night = boot({ search: "?now=2026-11-10T21:00:00-06:00&freeze=1" });
  assert.equal(night.HouseScene.phase(night.HouseScene.now()), "night");
});

test("boys glass drops provider and therapy text and keeps one canonical time", () => {
  const ctx = boot();
  const D = ctx.HouseEventDisplay;
  const raw = {
    id: "prov",
    kind: "school",
    summary: "provider check-in · confirmed Mon 9:00",
    description: "therapy notes stay off glass",
    startIso: "2026-11-10T14:50:00.000Z"
  };
  assert.equal(D.summarize(raw, "hayes"), null);
  assert.equal(D.summarize(raw, "harris"), null);
  assert.equal(D.summarize({ summary: raw.summary, providerOptIn: true }, "hayes"), null);
  assert.equal(D.summarize({ summary: "Harris — clinical check-in" }, "harris"), null);
  assert.equal(D.summarize({ summary: "Hayes — provider check-in · confirmed Mon 9:00" }, "hayes"), null);
  const pickup = D.summarize({
    id: "pick",
    kind: "school_pickup",
    summary: "Hayes — school pickup",
    description: "front door",
    startIso: "2026-11-10T21:15:00.000Z"
  }, "hayes");
  assert.equal(pickup.title, "School pickup");
  assert.equal(pickup.time, "3:15 PM");
  assert.equal(D.summarize({
    id: "pick-hidden",
    kind: "school_pickup",
    summary: "Hayes — school pickup",
    description: raw.description,
    startIso: "2026-11-10T21:15:00.000Z"
  }, "hayes"), null);
  const soccer = D.summarize({
    id: "soc",
    kind: "leave",
    summary: "soccer · 6:30-7:30",
    startIso: "2026-11-11T00:00:00.000Z"
  }, "harris");
  assert.equal(soccer.title, "Leave for soccer");
  assert.equal(soccer.time, "6:00 PM");
  assert.equal(/6:30/.test(soccer.title + soccer.time), false);
  const swimShared = D.summarize({
    id: "swim",
    kind: "sport",
    summary: "Ainsley swim",
    startIso: "2026-11-10T22:25:00.000Z"
  }, "shared");
  assert.equal(swimShared.title, "Swim");
  assert.equal(swimShared.time, "4:25 PM");
  const swimKid = D.summarize({
    summary: "Ainsley swim",
    startIso: "2026-11-10T22:25:00.000Z"
  }, "ainsley");
  assert.equal(swimKid.title, "Swim");
  /* Dan, Nov 10 2026, 6:08 PM CT: Ainsley's schedule shows the real time. */
  assert.equal(swimKid.time, "4:25 PM");
  assert.equal(/\d/.test(swimKid.title), false);
  const week = {
    kids: {
      hayes: { today: [raw, { id: "pick", kind: "school_pickup", what: "Hayes — school pickup", startIso: "2026-11-10T21:15:00.000Z", hint: "front door" }] },
      ainsley: { today: [{ summary: "Swim leave", startIso: "2026-11-10T22:25:00.000Z", what: "4:25 swim" }] }
    }
  };
  D.scrubPayload(week);
  assert.equal(week.kids.hayes.today.length, 1);
  assert.equal(week.kids.hayes.today[0].what, "School pickup");
  assert.equal(JSON.stringify(week.kids.hayes).includes("provider"), false);
  assert.equal(JSON.stringify(week.kids.hayes).includes("therapy"), false);
  assert.equal(/\d/.test(week.kids.ainsley.today[0].what), false);
  const html = D.summarize({ summary: "<img src=x onerror=alert(1)> soccer", kind: "sport", startIso: "2026-11-11T00:00:00.000Z" }, "harris");
  assert.equal(html.title, "Soccer");
  assert.equal(String(html.title).includes("onerror"), false);
  assert.equal(D.summarize({ summary: "Canceled Sample visit", startIso: "2026-11-10T21:00:00.000Z" }, "hayes"), null);
});

test("diagnostic snapshot is numeric display state only", () => {
  const ctx = boot({ w: 1536, h: 864, dpr: 1.25, search: "?diag=1" });
  ctx.localStorage.setItem("wardos-lights-proxy-token", "paired-test-key-value");
  const snap = ctx.WardosStage.diagSnapshot();
  assert.equal(ctx.WardosStage.diagWanted(), true);
  assert.deepEqual(Object.keys(snap).sort(), [
    "availHeight", "availWidth", "ct", "devicePixelRatio", "innerHeight", "innerWidth",
    "screenHeight", "screenWidth", "stageScale", "visualHeight", "visualScale", "visualWidth"
  ]);
  assert.equal(snap.innerWidth, 1536);
  assert.equal(snap.innerHeight, 864);
  assert.equal(snap.devicePixelRatio, 1.25);
  assert.equal(snap.stageScale, 0.8);
  assert.equal(JSON.stringify(snap).includes("paired-test-key-value"), false);
  const off = boot({ search: "" });
  assert.equal(off.WardosStage.diagWanted(), false);
});

test("plate colors clear the contrast floor and the hub keeps its grid", () => {
  assert.ok(contrast("#F4EFE6", "#101820") >= 4.5);
  const css = read("wall-acer-lock.css");
  assert.match(css, /grid-template-columns: 284px 284px 592px 592px/);
  assert.match(css, /width: 1920px !important/);
  assert.match(css, /height: 1080px !important/);
  assert.doesNotMatch(css, /left:\s*-3200px/);
  assert.doesNotMatch(css, /@media/);
  assert.match(read("sheet-index.html"), /class="hub-launch"/);
  assert.match(read("sheet-index.html"), /hub-window-day-900x864|house-scene\.js/);
  assert.equal(fs.existsSync(path.join(ROOT, "month-theme/november/hub-window-day-900x864.webp")), true);
});
