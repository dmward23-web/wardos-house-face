// node livinghouse/tests/lh-l4-browser.mjs
// Playwright-free browser gate: system Chrome over the devtools protocol, synthetic fixtures only.
// Proves the date gates, the empty plates, the crypt photo hook, idle cinema, and a 60s probe.
import { assertSealed } from "../../scripts/qa/temp-home.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

assertSealed();
const req = createRequire(import.meta.url);
const Packs = req("../scene-packs.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = "/opt/cursor/artifacts/lh-l4-crypt-cinema-seasons";
const CHROME = ["/usr/bin/google-chrome", "/opt/google/chrome/chrome"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BAD = [/kids away/i, /back in \d+ days/i, /dad week/i, /away week/i, /home week/i, /custody/i, /who.s where/i, /hand-?off/i, /their mom/i, /\bkristin\b/i, /\berin\b/i, /\bmom\b/i];

function months() {
  const days = {};
  const put = (iso, withDan) => { days[iso] = { withDan }; };
  for (let d = 20; d <= 23; d++) put(`2026-10-${d}`, true);
  for (let d = 24; d <= 26; d++) put(`2026-10-${String(d).padStart(2, "0")}`, false);
  for (let d = 27; d <= 31; d++) put(`2026-10-${d}`, true);
  for (let d = 1; d <= 30; d++) put(`2026-11-${String(d).padStart(2, "0")}`, true);
  for (let d = 1; d <= 15; d++) put(`2026-12-${String(d).padStart(2, "0")}`, true);
  return { status: "live", fetchedAt: new Date().toISOString(), days };
}
function cal() {
  return {
    status: "live",
    fetchedAt: new Date().toISOString(),
    upcomingLeaves: [
      { id: "item-1", summary: "Item 1 leave 2:10 PM", start: "2026-10-22T15:30:00-05:00", end: "2026-10-22T16:30:00-05:00", allDay: false },
      { id: "kid-a", summary: "Kid A practice", start: "2026-10-22T18:00:00-05:00", end: "2026-10-22T19:00:00-05:00", allDay: false },
      { id: "item-28", summary: "Item 1", start: "2026-10-28T15:00:00-05:00", end: "2026-10-28T16:00:00-05:00", allDay: false },
      { id: "drop-me", summary: "Kids away", start: "2026-10-22T12:00:00-05:00", end: "2026-10-22T13:00:00-05:00", allDay: false }
    ]
  };
}

let mode = "live";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf", ".png": "image/png", ".svg": "image/svg+xml" };

function startServer() {
  const server = http.createServer((rq, rs) => {
    const u = new URL(rq.url, "http://127.0.0.1");
    const p = decodeURIComponent(u.pathname);
    const send = (code, body, type) => { rs.writeHead(code, { "content-type": type || "application/json", "cache-control": "no-store" }); rs.end(body); };
    if (p === "/night/media/caps.json" && mode === "caps") return send(200, JSON.stringify({ video: true }));
    if (mode !== "missing" && (p === "/data/cal-live.json" || p === "/data/cal-live.raw.json")) return send(200, JSON.stringify(cal()));
    if (mode !== "missing" && p === "/data/cal-months.json") return send(200, JSON.stringify(months()));
    if (p.startsWith("/data/") || p === "/kids-week.json") return send(404, JSON.stringify({ error: "missing" }));
    const fp = path.normalize(path.join(ROOT, p));
    if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) return send(403, "{}");
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return send(404, JSON.stringify({ error: "not found" }));
    rs.writeHead(200, { "content-type": TYPES[path.extname(fp)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(fp).pipe(rs);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launchChrome() {
  assert.ok(CHROME, "system Chrome is required for the livinghouse browser gate");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-l4-chrome-"));
  const proc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--remote-debugging-port=0", `--user-data-dir=${dir}`, "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let buf = "";
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome debug port did not open")), 20000);
    const on = (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) { clearTimeout(t); resolve(+m[1]); }
    };
    proc.stderr.on("data", on); proc.stdout.on("data", on);
    proc.on("exit", () => { clearTimeout(t); reject(new Error("chrome exited early")); });
  });
  const ver = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
  const page = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
  const ws = new WebSocket(page.webSocketDebuggerUrl || ver.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  let seq = 0;
  const pending = new Map();
  const requests = [];
  const errors = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Network.requestWillBeSent") requests.push(msg.params.request.url);
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception && d.exception.description ? d.exception.description : d.text);
    }
    if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
  });
  function send(method, params) {
    const id = ++seq;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  }
  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");
  return {
    proc, dir, requests, errors, send, ws,
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        const msg = (d.exception && (d.exception.description || d.exception.value)) || d.text || "eval failed";
        throw new Error(String(msg).slice(0, 500));
      }
      return r.result.value;
    }
  };
}

async function shot(cdp, file) {
  const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 62 });
  fs.writeFileSync(file, Buffer.from(r.data, "base64"));
}

async function open(cdp, url, w, h) {
  cdp.requests.length = 0;
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 800 });
  await cdp.send("Page.navigate", { url });
  const deadline = Date.now() + 20000;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const ok = await cdp.eval("!!document.documentElement && document.documentElement.classList.contains('lh-ready')");
      if (ok) break;
    } catch (err) { last = String(err.message || err); }
    await sleep(150);
  }
  if (last) console.error("last eval note:", last.slice(0, 300));
  const ready = await cdp.eval("document.documentElement.classList.contains('lh-ready')");
  if (!ready) {
    const info = await cdp.eval("JSON.stringify({ href: location.href, title: document.title, err: window.__lhBoot || '', text: (document.body && document.body.innerText || '').slice(0, 180) })");
    assert.equal(ready, true, "page did not become ready: " + url + " " + info);
  }
  await sleep(400);
}

function stateExpr() {
  return `(() => {
    const de = document.documentElement, q = (s) => document.querySelector(s);
    const board = q(".lh-board").getBoundingClientRect();
    const dad = q(".lh-dad .lh-plaque").getBoundingClientRect();
    const count = document.getElementById("lh-count");
    const plate = document.getElementById("lh-plate");
    const photo = q(".lh-crypt-photo");
    const away = q(".lh-away");
    const cinema = document.getElementById("lh-cinema");
    return {
      season: de.getAttribute("data-season"),
      plateId: de.getAttribute("data-plate"),
      art: de.getAttribute("data-art"),
      streetArt: de.getAttribute("data-street-art"),
      street: de.classList.contains("lh-street"),
      glow: de.classList.contains("lh-halloween"),
      away: de.classList.contains("lh-state-away"),
      days: count.getAttribute("data-days"),
      countHidden: count.hidden,
      countText: count.querySelector("[data-lh=count]").textContent,
      pumpkins: count.querySelectorAll(".pumpkin").length,
      plateHidden: plate.hidden,
      plateText: q("[data-lh=season]").textContent,
      plateFeed: plate.getAttribute("data-feed"),
      plateWhy: plate.getAttribute("data-why"),
      leavesHidden: document.getElementById("lh-leaves").hidden,
      cinema: de.getAttribute("data-cinema"),
      drift: de.classList.contains("lh-drift"),
      rhythm: de.getAttribute("data-rhythm"),
      clock: !!q(".lh-clocktag"),
      probe: !!q(".lh-probe"),
      sign: q(".lh-board").textContent,
      signW: board.width,
      dad: q(".lh-dad .lh-plaque").textContent,
      dadH: dad.height,
      doorH: document.getElementById("lh-crypt-door").getBoundingClientRect().height,
      win: q(".lh-win").className,
      awayHidden: away.hidden,
      awayText: away.innerText.trim(),
      photoFeed: photo.getAttribute("data-feed"),
      photoWhy: photo.getAttribute("data-why"),
      photoImg: !!photo.querySelector("img"),
      jarsFeed: document.getElementById("lh-jars").getAttribute("data-feed"),
      jars: document.getElementById("lh-jars").innerText,
      cinemaSrc: cinema.getAttribute("src") || "",
      text: document.body.innerText,
      aria: [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).join("\\n"),
      rhythmRaw: localStorage.getItem("lh-rhythm-v1")
    };
  })()`;
}

function words(s) {
  for (const re of BAD) assert.equal(re.test(s), false, "visible copy matched " + re);
}

function checkPack(got, iso) {
  const p = Packs.forDate(new Date(iso));
  assert.equal(got.season, p.id, iso);
  assert.equal(got.plateId, p.plate, iso);
  assert.equal(got.art, p.art, iso);
  assert.equal(got.street, p.street, iso);
  assert.equal(got.glow, p.glow, iso);
  assert.equal(got.countHidden, !p.countdown, iso);
  assert.equal(got.days, String(p.days), iso);
  if (p.countdown && p.tonight) {
    assert.match(got.countText, /^(Tonight|Time to go!)/, iso);
    assert.equal(got.pumpkins, 1, iso);
  } else if (p.countdown) {
    assert.equal(got.countText, String(p.days), iso);
    assert.equal(got.pumpkins, p.days, iso);
  }
  assert.equal(got.plateHidden, p.art !== "missing", iso);
  if (p.art === "missing") {
    assert.equal(got.plateFeed, "missing", iso);
    assert.equal(got.plateWhy, p.why, iso);
    assert.equal(got.plateText, p.id === "december" ? "No snow yet" : "No harvest yet", iso);
    assert.equal(/\bplate\b/i.test(got.plateText), false, iso);
    assert.equal(got.leavesHidden, true, iso);
  }
  if (p.street) assert.equal(got.streetArt, "missing", iso);
  assert.equal(got.sign, "The Ward's");
  assert.ok(got.signW >= 40, "sign not legible");
  assert.equal(got.dad, "Dad");
  assert.ok(got.doorH >= 44, "crypt door under 44px");
  assert.equal(got.photoFeed, "missing");
  assert.equal(got.photoWhy, "photo index not approved");
  assert.equal(got.photoImg, false);
  assert.equal(got.rhythm, "collect");
  assert.equal(got.clock, true);
  assert.equal(got.probe, false);
  words(got.text);
  words(got.aria);
  assert.equal(/kids away/i.test(got.jars), false);
  if (got.rhythmRaw) {
    const j = JSON.parse(got.rhythmRaw);
    assert.equal(j.mode, "collect");
    assert.equal(JSON.stringify(j).includes("Item"), false);
    assert.equal(JSON.stringify(j).includes("Kid"), false);
    for (const row of j.rows) assert.deepEqual(Object.keys(row).sort(), ["min", "wd"]);
  }
}

const SIZES = [["wall", 1920, 1080], ["phone440", 440, 956], ["phone390", 390, 844]];
const DATES = [
  ["oct23", "2026-10-23T18:00:00-05:00"],
  ["oct24", "2026-10-24T18:00:00-05:00"],
  ["oct28", "2026-10-28T18:00:00-05:00"],
  ["oct31", "2026-10-31T18:00:00-05:00"],
  ["nov01", "2026-11-01T18:00:00-06:00"],
  ["dec01", "2026-12-01T18:00:00-06:00"]
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const cdp = await launchChrome();
  try {
    mode = "live";
    const bare = origin + "/livinghouse/index.html";
    await open(cdp, bare, 1920, 1080);
    let s = await cdp.eval(stateExpr());
    const today = Packs.forDate(new Date());
    assert.equal(s.season, today.id, "real clock picks the pack");
    assert.equal(s.clock, false, "no CLOCK OVERRIDE without ?now");
    assert.equal(s.probe, false, "no probe overlay without ?probe");
    assert.equal(s.cinemaSrc, "");
    words(s.text);
    await shot(cdp, path.join(OUT, "wall-no-override.jpg"));

    for (const [name, w, h] of SIZES) {
      for (const [tag, iso] of DATES) {
        await open(cdp, `${origin}/livinghouse/index.html?now=${encodeURIComponent(iso)}&freeze=1`, w, h);
        s = await cdp.eval(stateExpr());
        checkPack(s, iso);
        assert.equal(cdp.requests.some((u) => /\.mp4(\?|$)/.test(u)), false, "no mp4 while caps is false");
        const file = path.join(OUT, `${name}-${tag}.jpg`);
        await shot(cdp, file);
        if (tag === "oct23") fs.copyFileSync(file, path.join(OUT, `before-${name}.jpg`));
        if (tag === "oct24") fs.copyFileSync(file, path.join(OUT, `after-${name}.jpg`));
      }
    }

    await open(cdp, origin + "/livinghouse/index.html?now=2026-10-22T06:30:00-05:00&freeze=1", 1920, 1080);
    s = await cdp.eval(stateExpr());
    assert.equal(s.season, "october");
    assert.equal(s.away, false);
    assert.equal(s.countHidden, true);
    assert.match(s.text, /6:30/);
    assert.match(s.jars, /Item 1/);
    assert.match(s.jars, /Kid A practice/);
    words(s.text);
    await shot(cdp, path.join(OUT, "wall-dad-0630.jpg"));

    await open(cdp, origin + "/livinghouse/index.html?now=2026-10-24T18:00:00-05:00&freeze=1", 1920, 1080);
    s = await cdp.eval(stateExpr());
    assert.equal(s.away, true);
    assert.equal(s.awayHidden, false);
    assert.equal(s.awayText, "");
    assert.match(s.win, /dark/);
    assert.equal(s.days, "5");
    words(s.text);
    await shot(cdp, path.join(OUT, "wall-away-oct24.jpg"));

    await open(cdp, origin + "/livinghouse/index.html?now=2026-10-27T18:00:00-05:00&freeze=1", 1920, 1080);
    s = await cdp.eval(stateExpr());
    assert.equal(s.away, false, "return day is the home board, with no words");
    assert.equal(s.season, "october-count");
    assert.equal(s.days, "2");
    words(s.text);
    await shot(cdp, path.join(OUT, "wall-return-oct27.jpg"));

    await cdp.eval("document.getElementById('lh-crypt-door').click()");
    await sleep(200);
    s = await cdp.eval(stateExpr());
    assert.equal(s.photoFeed, "missing");
    assert.equal(s.photoImg, false);
    await shot(cdp, path.join(OUT, "wall-crypt.jpg"));
    await cdp.eval("document.getElementById('lh-crypt-close').click()");

    mode = "missing";
    await open(cdp, origin + "/livinghouse/index.html?now=2026-11-01T18:00:00-06:00&freeze=1", 1920, 1080);
    s = await cdp.eval(stateExpr());
    assert.equal(s.art, "missing");
    assert.equal(s.plateText, "No harvest yet");
    assert.equal(s.away, false, "a missing away feed is the awake board");
    assert.equal(s.jarsFeed, "missing");
    assert.match(s.jars, /No moments yet/);
    assert.doesNotMatch(s.text, /offline/i, "WGQUIET1: a missing feed is silent");
    words(s.text);
    await shot(cdp, path.join(OUT, "wall-missing-nov01.jpg"));

    mode = "live";
    await open(cdp, origin + "/livinghouse/index.html?now=2026-10-23T18:00:00-05:00&freeze=1", 1920, 1080);
    await cdp.eval("window.LivingHouse.noteIdle(60000)");
    await sleep(300);
    s = await cdp.eval(stateExpr());
    assert.equal(s.cinema, "poster");
    assert.equal(s.drift, true);
    assert.equal(s.cinemaSrc, "");
    assert.equal(cdp.requests.some((u) => /\.mp4(\?|$)/.test(u)), false);
    await shot(cdp, path.join(OUT, "wall-cinema.jpg"));
    await cdp.eval("window.dispatchEvent(new Event('pointerdown'))");
    s = await cdp.eval(stateExpr());
    assert.equal(s.cinema, "off");
    assert.equal(s.drift, false);

    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await open(cdp, origin + "/livinghouse/index.html?now=2026-10-23T18:00:00-05:00&freeze=1", 1920, 1080);
    await cdp.eval("window.LivingHouse.noteIdle(60000)");
    s = await cdp.eval(stateExpr());
    assert.equal(s.cinema, "off", "reduced motion never starts cinema");
    assert.equal(s.drift, false);
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });

    mode = "caps";
    await open(cdp, origin + "/livinghouse/index.html?now=2026-10-23T18:00:00-05:00&freeze=1", 1920, 1080);
    await cdp.eval("window.LivingHouse.noteIdle(60000)");
    await sleep(500);
    assert.ok(cdp.requests.some((u) => u.includes("/night/media/loop-night-rain-calm-wall.mp4")), "wall idle asks only for the calm loop");
    await open(cdp, origin + "/livinghouse/index.html?now=2026-10-23T18:00:00-05:00&freeze=1", 390, 844);
    await cdp.eval("window.LivingHouse.noteIdle(60000)");
    await sleep(500);
    assert.ok(cdp.requests.some((u) => u.includes("/night/media/loop-night-rain-calm-phone.mp4")), "phone idle asks for the phone loop");
    s = await cdp.eval(stateExpr());
    assert.equal(s.cinemaSrc, "", "a missing loop clears its src");

    mode = "live";
    for (const [name, w, h] of SIZES) {
      cdp.errors.length = 0;
      await open(cdp, origin + "/livinghouse/index.html?probe=1&freeze=1&now=2026-10-23T18:00:00-05:00", w, h);
      const t0 = Date.now();
      let n = 0;
      while (Date.now() - t0 < 70000) {
        n = await cdp.eval("(window.__lhProbe || []).length");
        if (n >= 60) break;
        await sleep(1000);
      }
      const log = await cdp.eval("window.__lhProbe");
      assert.ok(log && log.length >= 60, name + " probe samples " + (log && log.length));
      const row = log[log.length - 1];
      for (const k of ["fps", "longtasks", "longMax", "heap", "dom"]) assert.ok(k in row, k);
      fs.writeFileSync(path.join(OUT, `probe-${w}x${h}.json`), JSON.stringify({ viewport: { w, h }, samples: log.length, log }, null, 1));
      assert.equal(await cdp.eval("!!document.querySelector('.lh-probe')"), true);
      assert.equal(await cdp.eval("!!document.querySelector('.lh-clocktag')"), true, "freeze+now still shows the clock tag");
    }

    const mine = cdp.errors.filter((e) => /livinghouse\/(lh|scene-packs|cinema|crypt|rhythm)/.test(e));
    assert.deepEqual(mine, [], "livinghouse script errors");
    console.log("lh-l4-browser: ok");
  } finally {
    try { cdp.ws.close(); } catch { /* already closed */ }
    try { cdp.proc.kill(); } catch { /* already gone */ }
    await Promise.race([new Promise((r) => cdp.proc.once("exit", r)), sleep(2000)]);
    server.close();
    for (let i = 0; i < 8; i++) {
      try { fs.rmSync(cdp.dir, { recursive: true, force: true }); break; } catch { await sleep(200); }
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
