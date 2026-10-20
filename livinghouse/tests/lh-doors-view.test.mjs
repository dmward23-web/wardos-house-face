// node livinghouse/tests/lh-doors-view.test.mjs
// Layout at 1920x1080, 440x956 and 390x844, plus clock fixtures. Synthetic feeds only (Item 1, Kid A).
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { launchChrome, cdp, openPage, closePage, evalJson } from "./chrome-shot.mjs";

/* Node 20 has no global WebSocket. Node 22 does. Load the ws package only when the global is missing. */
if (typeof globalThis.WebSocket !== "function") {
  let WS;
  try { WS = (await import("ws")).default; }
  catch { WS = createRequire(import.meta.url)("ws"); }
  if (typeof WS !== "function") throw new Error("ws did not provide a WebSocket");
  globalThis.WebSocket = WS;
}

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DAYS = {
  "2026-10-20": { withDan: true }, "2026-10-21": { withDan: true }, "2026-10-22": { withDan: true },
  "2026-10-23": { withDan: true }, "2026-10-24": { withDan: false }, "2026-10-25": { withDan: true },
  "2026-10-30": { withDan: true }, "2026-10-31": { withDan: true }, "2026-11-01": { withDan: true },
  "2026-11-02": { withDan: true }, "2026-11-30": { withDan: true }, "2026-12-01": { withDan: true }, "2026-12-02": { withDan: true },
};
const CAL = {
  status: "live", fetchedAt: new Date().toISOString(),
  upcomingLeaves: [{ id: "item-1", summary: "Item 1", start: "2026-10-21T15:00:00-05:00", end: "2026-10-21T16:00:00-05:00", allDay: false }],
};
const MONTHS = { status: "live", fetchedAt: new Date().toISOString(), changeMin: 600, days: DAYS };
const FEEDS = {
  "/data/cal-live.json": CAL,
  "/data/cal-months.json": MONTHS,
  "/data/lights-live.json": { status: "live", fetchedAt: new Date().toISOString(), lights: [] },
  "/data/sensi-live.json": { status: "live", fetchedAt: new Date().toISOString() },
  "/data/nest-live.json": { status: "live", fetchedAt: new Date().toISOString(), cameras: [] },
  "/kids-week.json": { kids: {} },
};
const BANNED = /kids away|back in \d+ days|kids back|dad week|away week|home week|handoff|who's where|who’s where|\bcustody\b|their mom|kids with you|before friday/i;

function start(mode) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    if (/^\/(?:data\/(?:cal-live|cal-months|lights-live|sensi-live|nest-live)\.json|kids-week\.json)$/.test(path)) {
      if (mode === "missing" || !FEEDS[path]) { res.writeHead(404); res.end("missing"); return; }
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(FEEDS[path])); return;
    }
    const file = ROOT + path;
    try {
      const st = statSync(file);
      if (!st.isFile()) throw new Error("dir");
      res.writeHead(200); res.end(readFileSync(file));
    } catch (e) { res.writeHead(404); res.end("no"); }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const LAYOUT = `(() => {
  const bad = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > innerWidth + 1 || doc.scrollHeight > innerHeight + 1) bad.push("page overflow " + doc.scrollWidth + "x" + doc.scrollHeight);
  function textBox(el) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, box = null;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(n); const r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      box = box ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom, t: n.textContent.trim() };
    }
    return box;
  }
  const sel = "#lh-doors .lh-door, .lh-board, .lh-kw .name, .lh-plaque, .lh-feedtag, .back, .out a, .yard li a, h1, [data-room=plate-text], [data-room=empty], [data-room=earn-empty]";
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest("[hidden]")) continue;
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const tb = textBox(el); if (!tb) continue;
    const r = el.getBoundingClientRect();
    if (tb.right > r.right + 1 || tb.left < r.left - 1 || tb.bottom > r.bottom + 1 || tb.top < r.top - 1) bad.push("clip " + tb.t.slice(0, 24));
    let scrolls = false, p = el.parentElement;
    while (p) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY)) scrolls = true; p = p.parentElement; }
    const onScreen = tb.bottom > 0 && tb.top < innerHeight && tb.right > 0 && tb.left < innerWidth;
    if (!scrolls || onScreen) {
      if (tb.left < -1 || tb.top < -1 || tb.right > innerWidth + 1 || tb.bottom > innerHeight + 1) bad.push("off " + tb.t.slice(0, 24));
    }
  }
  for (const el of document.querySelectorAll("#lh-doors .lh-door, .back, .out a")) {
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) bad.push("small " + (el.getAttribute("data-door") || el.textContent.trim()));
  }
  const body = document.body.innerText || "";
  if (${BANNED.toString()}.test(body)) bad.push("banned wording");
  return { bad, away: document.documentElement.classList.contains("lh-state-away") || document.documentElement.classList.contains("lh-room-away"),
    halloween: document.documentElement.classList.contains("lh-halloween"),
    leavesHidden: !!document.getElementById("lh-leaves") && document.getElementById("lh-leaves").hidden,
    clock: !!document.querySelector(".lh-clocktag"), probe: !!document.querySelector(".lh-probe"),
    errs: window.__lhErr || [], state: (document.getElementById("room") || {}).getAttribute ? document.getElementById("room") && document.getElementById("room").getAttribute("data-state") : "",
    feed: (document.getElementById("room") || {}).getAttribute ? document.getElementById("room") && document.getElementById("room").getAttribute("data-feed") : "" };
})()`;

async function ready(b, sid) {
  await evalJson(b, sid, `new Promise((res) => { const t0 = Date.now(); const tick = () => {
    const de = document.documentElement; if (!de) { if (Date.now() - t0 > 9000) res(0); else setTimeout(tick, 80); return; }
    const house = document.getElementById("lh"); const room = document.getElementById("room"); const yard = document.querySelector(".yard");
    if ((house && de.classList.contains("lh-ready")) || (room && de.classList.contains("lh-ready")) || yard || Date.now() - t0 > 9000) res(1); else setTimeout(tick, 80);
  }; tick(); })`);
  await evalJson(b, sid, `new Promise((r) => setTimeout(r, 200))`);
}

async function visit(b, url, w, h, fn) {
  const page = await openPage(b, url, w, h);
  try { return await fn(page.sessionId); }
  finally { await closePage(b, page); }
}

const sizes = [[1920, 1080], [440, 956], [390, 844]];
let failed = 0;
function check(label, cond, detail) { if (!cond) { failed++; console.error("FAIL", label, detail || ""); } }

const synth = await start("synth");
const missing = await start("missing");
const port = (s) => s.address().port;
const { proc, ws } = await launchChrome(9340 + Math.floor(Math.random() * 200));
const b = cdp(ws);

try {
  for (const [w, h] of sizes) {
    for (const path of ["/livinghouse/index.html", "/livinghouse/room.html?kid=ainsley", "/livinghouse/room.html?kid=hayes", "/livinghouse/room.html?kid=harris", "/livinghouse/room.html?door=garage", "/livinghouse/yard.html"]) {
      await visit(b, `http://127.0.0.1:${port(missing)}` + path, w, h, async (sid) => {
        await ready(b, sid);
        const info = await evalJson(b, sid, LAYOUT);
        check(w + "x" + h + " " + path, info.bad.length === 0, info.bad.join("; "));
        check(w + "x" + h + " " + path + " no clock tag", info.clock === false);
        check(w + "x" + h + " " + path + " no probe", info.probe === false);
        if (path.includes("room.html")) check(path + " missing plate", info.feed === "missing");
      });
    }
  }

  const cases = [
    ["dad-day", "2026-10-21T15:00:00-05:00", { away: false }],
    ["away-day", "2026-10-24T15:00:00-05:00", { away: true }],
    ["return-day", "2026-10-25T11:00:00-05:00", { away: false }],
    ["school-morning", "2026-10-21T06:30:00-05:00", { away: false }],
    ["oct-31", "2026-10-31T20:00:00-05:00", { away: false, halloween: true }],
    ["nov-1", "2026-11-01T20:00:00-05:00", { away: false, halloween: false, leaves: true }],
    ["dec-1", "2026-12-01T20:00:00-05:00", { away: false, halloween: false, leaves: true }],
  ];
  for (const [name, iso, expect] of cases) {
    for (const [w, h] of sizes) {
      await visit(b, `http://127.0.0.1:${port(synth)}/livinghouse/index.html?now=${encodeURIComponent(iso)}&freeze=1`, w, h, async (sid) => {
        await ready(b, sid);
        const info = await evalJson(b, sid, LAYOUT);
        check(name + " " + w + " layout", info.bad.length === 0, info.bad.join("; "));
        check(name + " " + w + " away", info.away === expect.away, "away=" + info.away);
        check(name + " " + w + " clock tag", info.clock === true);
        if (expect.halloween != null) check(name + " halloween", info.halloween === expect.halloween);
        if (expect.leaves != null) check(name + " leaves hidden", info.leavesHidden === expect.leaves);
      });
    }
    await visit(b, `http://127.0.0.1:${port(synth)}/livinghouse/room.html?kid=hayes&now=${encodeURIComponent(iso)}&freeze=1`, 390, 844, async (sid) => {
      await ready(b, sid);
      const room = await evalJson(b, sid, LAYOUT);
      check(name + " hayes room layout", room.bad.length === 0, room.bad.join("; "));
      check(name + " hayes room away", room.away === expect.away, room.state);
      if (expect.away) {
        const text = await evalJson(b, sid, `document.body.innerText`);
        check(name + " no item on away room", !/Item 1/.test(text));
      }
    });
  }

  await visit(b, `http://127.0.0.1:${port(missing)}/livinghouse/index.html?now=2026-10-24T15:00:00-05:00&freeze=1`, 1920, 1080, async (sid) => {
    await ready(b, sid);
    const missInfo = await evalJson(b, sid, LAYOUT);
    check("missing feed is not an away day", missInfo.away === false, "away");
    check("missing feed layout", missInfo.bad.length === 0, missInfo.bad.join("; "));
  });

  await visit(b, `http://127.0.0.1:${port(missing)}/sheet-sensi.html?from=lh`, 390, 844, async (sid) => {
    await evalJson(b, sid, `new Promise((res) => { const t0 = Date.now(); const tick = () => { if (document.getElementById("lh-return") || Date.now() - t0 > 8000) res(1); else setTimeout(tick, 100); }; tick(); })`);
    const on = await evalJson(b, sid, `(() => { const a = document.getElementById("lh-return"); if (!a) return { ok:false, href: location.href }; const r = a.getBoundingClientRect(); return { ok:true, href:a.getAttribute("href"), t:a.textContent, w:r.width, h:r.height, left:r.left, top:r.top, right:r.right, bottom:r.bottom, iw:innerWidth, ih:innerHeight }; })()`);
    check("return chip shows", on.ok === true, JSON.stringify(on));
    check("return chip is House", on.t === "House" && /livinghouse\/index\.html/.test(on.href || ""));
    check("return chip inside", on.w >= 44 && on.h >= 44 && on.left >= -1 && on.top >= -1 && on.right <= on.iw + 1 && on.bottom <= on.ih + 1, JSON.stringify(on));
  });

  await visit(b, `http://127.0.0.1:${port(missing)}/sheet-sensi.html`, 390, 844, async (sid) => {
    await evalJson(b, sid, `new Promise((res) => { const t0 = Date.now(); const tick = () => { if (/sheet-google-home/.test(location.pathname) || Date.now() - t0 > 4000) res(1); else setTimeout(tick, 80); }; tick(); })`);
    await evalJson(b, sid, `new Promise((r) => setTimeout(r, 400))`);
    const off = await evalJson(b, sid, `!!document.getElementById("lh-return")`);
    check("no return chip without a door", off === false);
  });

  /* Same tab: an lh page, then a main page with no from=lh. The chip must not follow the tab. */
  const same = await openPage(b, `http://127.0.0.1:${port(missing)}/sheet-sensi.html?from=lh`, 390, 844);
  try {
    await evalJson(b, same.sessionId, `new Promise((res) => { const t0 = Date.now(); const tick = () => { if (document.getElementById("lh-return") || Date.now() - t0 > 8000) res(1); else setTimeout(tick, 100); }; tick(); })`);
    const armed = await evalJson(b, same.sessionId, `!!document.getElementById("lh-return") && /(?:^|[?&])from=lh(?:&|$)/.test(location.search)`);
    check("same tab starts on an lh page", armed === true);
    await b.send("Page.navigate", { url: `http://127.0.0.1:${port(missing)}/sheet-google-home.html` }, same.sessionId);
    const after = await evalJson(b, same.sessionId, `new Promise((res) => {
      const t0 = Date.now(); let seen = 0;
      const tick = () => {
        const clean = !!(document.documentElement) && /sheet-google-home/.test(location.pathname) && !/(?:^|[?&])from=lh(?:&|$)/.test(location.search);
        if (!clean) { if (Date.now() - t0 > 8000) res({ chip: !!document.getElementById("lh-return"), href: location.href, clean: false }); else setTimeout(tick, 50); return; }
        if (!seen) seen = Date.now();
        if (document.getElementById("lh-return")) { res({ chip: true, href: location.href, clean: true }); return; }
        if (Date.now() - seen > 1200) res({ chip: false, href: location.href, clean: true }); else setTimeout(tick, 80);
      };
      tick();
    })`);
    check("no return chip on a main page after an lh page in the same tab", after && after.clean === true && after.chip === false, JSON.stringify(after));
  } finally {
    await closePage(b, same);
  }
} finally {
  b.close(); proc.kill("SIGKILL");
  synth.close(); missing.close();
}

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("lh-doors-view: ok");
