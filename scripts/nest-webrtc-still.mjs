#!/usr/bin/env node
/**
 * Capture Nest WebRTC frames via Chrome CDP → data/nest-snaps/*.jpg
 * + refresh data/nest-live.json snapshotUrl fields (Pages-servable).
 *
 * Requires: nest-webrtc-proxy on 127.0.0.1:8787 + Chrome with
 *   --remote-debugging-port (default 19333) viewing nest-webrtc.html
 *
 * Usage:
 *   node scripts/nest-webrtc-still.mjs
 *   node scripts/nest-webrtc-still.mjs --cdp 19333 --cams "Front,Garage,Backyard"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SNAPS = path.join(ROOT, "data", "nest-snaps");
const LIVE = path.join(ROOT, "data", "nest-live.json");
const PROXY = process.env.NEST_PROXY || "http://127.0.0.1:8787";

function parseArgs(argv) {
  const out = { cdp: 19333, cams: null, waitMs: 12000, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--cdp" && argv[i + 1]) out.cdp = Number(argv[++i]);
    else if (a === "--cams" && argv[i + 1]) out.cams = argv[++i];
    else if (a === "--wait" && argv[i + 1]) out.waitMs = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function slug(name) {
  return String(name || "cam")
    .toLowerCase()
    .replace(/\s+camera$/i, "")
    .replace(/\s+doorbell$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "cam";
}

async function cdpConnect(port) {
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  const page = list.find((t) => t.type === "page" && /nest-webrtc/.test(t.url || ""));
  if (!page || !page.webSocketDebuggerUrl) {
    throw new Error("No nest-webrtc Chrome page on CDP :" + port + " — start chrome against proxy first");
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.once("open", res);
    ws.once("error", rej);
  });
  let nextId = 1;
  const pending = new Map();
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("CDP timeout " + method));
        }
      }, 60000);
    });
  }
  await send("Page.enable");
  await send("Runtime.enable");
  return { ws, send, pageUrl: page.url };
}

async function navigate(send, url) {
  const { frameId } = await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 800));
  return frameId;
}

async function waitForVideo(send, waitMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const r = await send("Runtime.evaluate", {
      expression: `(() => {
        const v = document.getElementById('vid');
        const err = document.getElementById('errbox');
        const pill = document.getElementById('live-pill');
        const st = document.getElementById('status');
        const errShow = err && err.classList.contains('show');
        const vw = v ? (v.videoWidth || 0) : 0;
        const vh = v ? (v.videoHeight || 0) : 0;
        return {
          vw, vh,
          ready: !!(v && v.srcObject && vw > 16 && vh > 16),
          errShow: !!errShow,
          errText: errShow ? (err.textContent || '').slice(0, 240) : '',
          pill: pill ? pill.textContent : '',
          status: st ? st.textContent : ''
        };
      })()`,
      returnByValue: true,
    });
    const v = r.result && r.result.value;
    if (v && v.ready) return v;
    if (v && v.errShow && /FAILED_PRECONDITION|Cannot reach|ERROR/i.test(v.errText || v.pill || "")) {
      const err = new Error(v.errText || v.pill || "stream error");
      err.meta = v;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("timeout waiting for video frames");
}

async function captureJpeg(send, outPath) {
  // Prefer canvas grab of the <video> element (tight crop); fall back to page screenshot.
  const r = await send("Runtime.evaluate", {
    expression: `(() => {
      const v = document.getElementById('vid');
      if (!v || !v.videoWidth) return { ok: false, reason: 'no video' };
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0);
      return { ok: true, dataUrl: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
    })()`,
    returnByValue: true,
    awaitPromise: false,
  });
  const val = r.result && r.result.value;
  if (val && val.ok && val.dataUrl) {
    const b64 = val.dataUrl.split(',', 2)[1];
    fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
    return { w: val.w, h: val.h, bytes: fs.statSync(outPath).size };
  }
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
  fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  return { w: null, h: null, bytes: fs.statSync(outPath).size, via: "page" };
}

async function listCams() {
  const headers = {};
  const tok = process.env.NEST_PROXY_TOKEN || "";
  if (tok) headers["X-Nest-Proxy-Token"] = tok;
  const data = await fetch(PROXY + "/api/cameras", { headers }).then((r) => r.json());
  if (!Array.isArray(data.cameras)) {
    throw new Error("cameras fetch failed: " + JSON.stringify(data).slice(0, 200));
  }
  return data.cameras;
}

function writeLive(cameras, meta) {
  const now = new Date().toISOString();
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(LIVE, "utf8"));
  } catch (_) {}
  const byId = new Map((prev.cameras || []).map((c) => [c.id, c]));
  const merged = cameras.map((c) => {
    const old = byId.get(c.id) || {};
    const snap = meta.snaps[c.id];
    return {
      ...old,
      ...c,
      snapshotUrl: snap ? snap.rel : old.snapshotUrl || null,
      snapCapturedAt: snap ? snap.at : old.snapCapturedAt || null,
      snapSize: snap ? snap.size : old.snapSize || null,
    };
  });
  const withSnaps = merged.filter((c) => c.snapshotUrl).length;
  const payload = {
    status: "live",
    fetchedAt: now,
    updatedAt: now,
    source: "nest-sdm+webrtc-still",
    cameras: merged,
    deviceCount: prev.deviceCount || merged.length,
    cameraCount: merged.length,
    stillsPending: withSnaps === 0,
    stillNote:
      withSnaps > 0
        ? "WebRTC canvas stills via nest-webrtc-still.mjs · Pages-servable data/nest-snaps"
        : "No stills captured",
    error: meta.errors.length ? meta.errors.slice(0, 5).join("; ") : null,
  };
  // NESTVID1: keep baked public nestProxy across still refreshes (do not drop).
  if (prev.nestProxy) payload.nestProxy = prev.nestProxy;
  // KEYROT1: never carry nestProxyToken into public JSON.
  if (prev.nestProxyPath) payload.nestProxyPath = prev.nestProxyPath;
  fs.mkdirSync(path.dirname(LIVE), { recursive: true });
  const tmp = LIVE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  fs.renameSync(tmp, LIVE);
  return payload;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node scripts/nest-webrtc-still.mjs [--cdp PORT] [--cams Front,Garage] [--wait MS]");
    process.exit(0);
  }
  fs.mkdirSync(SNAPS, { recursive: true });
  const cams = await listCams();
  if (!cams.length) throw new Error("no cameras from proxy");

  let want = cams;
  if (args.cams) {
    const parts = args.cams.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    want = cams.filter((c) => parts.some((p) => (c.name || "").toLowerCase().includes(p)));
    if (!want.length) want = cams;
  }

  const { send, ws } = await cdpConnect(args.cdp);
  const snaps = {};
  const errors = [];

  for (const cam of want) {
    const name = cam.name || "cam";
    const tok = process.env.NEST_PROXY_TOKEN || "";
    let url = PROXY + "/nest-webrtc.html?cam=" + encodeURIComponent(cam.id);
    if (tok) url += "&proxyToken=" + encodeURIComponent(tok);
    process.stdout.write("capture " + name + " … ");
    try {
      await navigate(send, url);
      const info = await waitForVideo(send, args.waitMs);
      const file = slug(name) + ".jpg";
      const abs = path.join(SNAPS, file);
      const shot = await captureJpeg(send, abs);
      if (shot.bytes < 800) throw new Error("jpeg too small (" + shot.bytes + ")");
      snaps[cam.id] = {
        rel: "data/nest-snaps/" + file,
        at: new Date().toISOString(),
        size: `${info.vw}x${info.vh}`,
        bytes: shot.bytes,
      };
      console.log("OK " + info.vw + "x" + info.vh + " → " + file + " (" + shot.bytes + "b)");
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      errors.push(name + ": " + msg.replace(/\s+/g, " ").slice(0, 120));
      console.log("FAIL " + msg.slice(0, 100));
    }
  }

  try {
    ws.terminate();
  } catch (_) {}

  const payload = writeLive(cams, { snaps, errors });
  const n = payload.cameras.filter((c) => c.snapshotUrl).length;
  console.log("nest-live.json stills=" + n + "/" + payload.cameras.length);
  if (n === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
