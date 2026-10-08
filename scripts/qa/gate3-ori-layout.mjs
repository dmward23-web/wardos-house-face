#!/usr/bin/env node
/**
 * GATE 3 — overlap, clip, and ellipsis.
 * Phone: 440×956 CSS pixels, deviceScaleFactor 3 (Dan's iPhone).
 * Wall: 1080×1920.
 * Any hit fails the build. house-face-qa.yml is a different workflow and stays as it is.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

function loadPuppeteer() {
  const roots = [];
  if (process.env.NODE_PATH) roots.push(...process.env.NODE_PATH.split(":"));
  roots.push("/tmp/ori-qa/node_modules", path.join(path.dirname(fileURLToPath(import.meta.url)), "../../node_modules"));
  for (const root of roots) {
    const pkg = path.join(root, "puppeteer-core/package.json");
    if (!fs.existsSync(pkg)) continue;
    return createRequire(pkg)("puppeteer-core");
  }
  throw new Error("puppeteer-core is not installed");
}
const puppeteer = loadPuppeteer();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PAGES = ["sheet-index.html", "month.html", "sheet-lights.html"];
const PORT = Number(process.env.ORI_QA_PORT || 8773);

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("Chrome not found. Set CHROME_PATH.");
}

function startServer() {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf"
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

const SCAN = `(() => {
  const hits = [];
  function shown(el) {
    if (!el || el.closest("[hidden]")) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  }
  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue || "";
    return t.replace(/\\s+/g, " ").trim();
  }
  function inView(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }
  function plateOpaque(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor || "";
      const m = bg.match(/rgba?\\(([^)]+)\\)/);
      if (m) {
        const p = m[1].split(",").map((s) => parseFloat(s));
        const a = p.length >= 4 ? p[3] : 1;
        if (a >= 0.82) return true;
      }
      n = n.parentElement;
    }
    return false;
  }
  function scanHere(tag) {
    const els = document.body.querySelectorAll("*");
    for (const el of els) {
      if (!shown(el)) continue;
      const text = ownText(el);
      if (text && inView(el) && (/\\u2026/.test(text) || /\\.{3}/.test(text))) {
        hits.push(tag + " ellipsis text <" + el.tagName.toLowerCase() + "." + (el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 40) : "") + "> " + text.slice(0, 80));
      }
      if (text && inView(el)) {
        const s = getComputedStyle(el);
        const clamped = s.webkitLineClamp && s.webkitLineClamp !== "none";
        const ell = s.textOverflow === "ellipsis" || clamped;
        if (ell && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
          hits.push(tag + " truncated <" + (el.className && String(el.className).slice(0, 40)) + "> " + text.slice(0, 60));
        }
        const rects = el.getClientRects();
        for (const box of rects) {
          if (box.width < 1 || box.height < 1) continue;
          if (box.bottom < 0 || box.top > innerHeight) continue;
          if (box.left < -1 || box.right > innerWidth + 1) {
            hits.push(tag + " clipped x=" + Math.round(box.left) + ".." + Math.round(box.right) + " vw=" + innerWidth + " <" + String(el.className).slice(0, 40) + "> " + text.slice(0, 60));
            break;
          }
        }
      }
      if (text && inView(el)) {
        let n = el.parentElement;
        while (n && n !== document.body) {
          const s = getComputedStyle(n);
          const oy = s.overflowY === "hidden" || s.overflow === "hidden";
          const ox = s.overflowX === "hidden" || s.overflow === "hidden";
          if ((ox || oy) && n.scrollHeight > n.clientHeight + 4) {
            const er = el.getBoundingClientRect();
            const nr = n.getBoundingClientRect();
            if (er.bottom > nr.bottom + 3 && er.top < nr.bottom) {
              hits.push(tag + " cut off inside <" + String(n.className).slice(0, 40) + "> " + text.slice(0, 60));
              break;
            }
          }
          n = n.parentElement;
        }
      }
    }
    document.querySelectorAll(".day .blk, .ori-ev, .ori-dom").forEach((el) => {
      if (!shown(el)) return;
      const cell = el.closest(".day, .ori-day");
      if (!cell) return;
      const a = el.getBoundingClientRect();
      const b = cell.getBoundingClientRect();
      if (a.right > b.right + 2 || a.left < b.left - 2 || a.bottom > b.bottom + 2) {
        hits.push(tag + " cell overflow <" + String(el.className).slice(0, 24) + "> " + ownText(el).slice(0, 60));
      }
    });
    const pills = [...document.querySelectorAll(".cmd-pill, .light-pad-src, .hub-lights-pill, .sp-pill, .light-pad-state, .hub-sw-stub-pill")].filter(shown);
    const controls = [...document.querySelectorAll(".cmd-rocker, .light-bright, input[type=range]")].filter(shown);
    for (const p of pills) {
      const a = p.getBoundingClientRect();
      for (const c of controls) {
        if (p.contains(c) || c.contains(p)) continue;
        const b = c.getBoundingClientRect();
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 4 && iy > 4) {
          hits.push(tag + " pill over control " + (ownText(p) || p.className).toString().slice(0, 40));
        }
      }
    }
    const blob = document.body.innerText || "";
    if (/calendar through|empty = unknown|TABLET TEST/i.test(blob)) hits.push(tag + " debug copy still on screen");
    if (document.documentElement.classList.contains("ori-phone")) {
      const edge = 8;
      const atTop = window.scrollY < 2;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const atBot = window.scrollY >= maxScroll - 2;
      const nodes = document.querySelectorAll(".hdr-date-long, .hdr-date-time, .live-clock, .home-btn, .cbtn, .cmd-chip, .month-title, .mpill, .ori-ev, .ori-dom, .banner, .light-pad-name, .light-pad-src, .connect-title, .cmd-title, .banner-title, .hub-cam-label, .tile-label, .leaveby-dest, .leaveby .time, .who-up-name, .who-up-kicker, .ori-peek-card");
      nodes.forEach((el) => {
        if (!shown(el) || el.closest(".ori-pool-hit")) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.height > innerHeight * 0.92) return;
        if (r.bottom <= 0 || r.top >= innerHeight) return;
        const label = (ownText(el) || String(el.className || el.id || "").slice(0, 24)).slice(0, 48);
        if (r.left < edge) hits.push(tag + " edge-left " + Math.round(r.left) + " " + label);
        if (r.right > innerWidth - edge) hits.push(tag + " edge-right " + Math.round(innerWidth - r.right) + " " + label);
        if (atTop && r.top >= 0 && r.top < edge) hits.push(tag + " edge-top " + Math.round(r.top) + " " + label);
        if (atTop && r.top < 0 && r.bottom > edge) hits.push(tag + " cut-top " + label);
        if (atBot && r.bottom <= innerHeight && r.bottom > innerHeight - edge) hits.push(tag + " edge-bottom " + Math.round(innerHeight - r.bottom) + " " + label);
        if (atBot && r.bottom > innerHeight && r.top < innerHeight - edge && r.top >= 0) hits.push(tag + " cut-bottom " + label);
      });
    }
  }
  const peekBtn = document.querySelector(".ori-pool-hit");
  const peek = document.querySelector(".ori-peek");
  if (document.documentElement.classList.contains("ori-phone") && peekBtn && peek && peek.hidden) peekBtn.click();
  const ys = [0];
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  if (max > 80) ys.push(Math.round(max * 0.5), max);
  for (const y of ys) {
    scrollTo(0, y);
    scanHere("y" + y);
  }
  scrollTo(0, 0);
  if (document.documentElement.classList.contains("ori-phone") && document.getElementById("hub-cam-deck")) {
    const marks = [];
    ["header.hdr", "#hub-cam-deck", ".leaveby", "#hub-lights-panel", "#hub-spotify-strip", ".who-up"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el || !shown(el)) return;
      const r = el.getBoundingClientRect();
      marks.push({ name: sel, t: r.top + scrollY, b: r.bottom + scrollY, l: r.left, r: r.right });
    });
    document.querySelectorAll(".tile-grid > .tile").forEach((el, i) => {
      if (!shown(el)) return;
      const r = el.getBoundingClientRect();
      marks.push({ name: "tile" + i, t: r.top + scrollY, b: r.bottom + scrollY, l: r.left, r: r.right });
    });
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        const a = marks[i], c = marks[j];
        const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
        const oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
        if (ox > 8 && oy > 8) hits.push("overlap " + a.name + " x " + c.name);
      }
    }
    const canvas = document.querySelector("canvas.ori-path");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const pr = canvas.getBoundingClientRect();
      document.querySelectorAll("header.hdr, #hub-cam-deck, .leaveby, #hub-lights-panel, #hub-spotify-strip, .who-up, .tile-grid > .tile").forEach((el) => {
        if (!shown(el)) return;
        const r = el.getBoundingClientRect();
        const samples = [
          [r.left + r.width * 0.5, r.top + Math.min(r.height * 0.5, 36)],
          [r.left + 14, r.top + Math.min(r.height * 0.45, 28)],
          [r.right - 14, r.top + Math.min(r.height * 0.45, 28)]
        ];
        for (const pair of samples) {
          const x = Math.round(pair[0] - pr.left);
          const y = Math.round(pair[1] - pr.top);
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
          let px;
          try { px = ctx.getImageData(x, y, 1, 1).data; } catch (e) { continue; }
          if (px[3] > 12) {
            hits.push("path through card " + String(el.id || el.className || "card").slice(0, 40));
            break;
          }
        }
      });
    }
    if (peek && peek.classList.contains("is-open") && shown(peek)) {
      const a = peek.getBoundingClientRect();
      document.querySelectorAll(".hub-cam-label, .hub-cam-media-wrap").forEach((lab) => {
        if (!shown(lab)) return;
        const b = lab.getBoundingClientRect();
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 2 && iy > 2) hits.push("peek covers " + (ownText(lab) || lab.className || "cam").toString().slice(0, 32));
      });
    }
  }
  document.querySelectorAll(".light-pad").forEach((el) => {
    if (!shown(el)) return;
    const bg = getComputedStyle(el).backgroundColor || "";
    const m = bg.match(/rgba?\\(([^)]+)\\)/);
    let alpha = 0;
    if (m) {
      const p = m[1].split(",").map((s) => parseFloat(s));
      alpha = p.length >= 4 ? p[3] : 1;
    }
    if (alpha < 0.82) hits.push("row missing plate " + (ownText(el) || "light").slice(0, 48));
  });
  if (document.documentElement.classList.contains("ori-phone")) {
    const texts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const raw = (textNode.nodeValue || "").replace(/\\s+/g, " ").trim();
      if (raw.length < 2) continue;
      const parent = textNode.parentElement;
      if (!parent || !shown(parent) || parent.closest("script, style, [hidden], .ori-iris, .ori-arrive")) continue;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      for (const box of range.getClientRects()) {
        if (box.width < 2 || box.height < 2) continue;
        if (box.bottom < 0 || box.top > innerHeight) continue;
        texts.push({ t: raw.slice(0, 42), l: box.left, r: box.right, top: box.top, b: box.bottom });
      }
      range.detach && range.detach();
    }
    let overlaps = 0;
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], c = texts[j];
        const ix = Math.min(a.r, c.r) - Math.max(a.l, c.l);
        const iy = Math.min(a.b, c.b) - Math.max(a.top, c.top);
        if (ix > 3 && iy > 3) {
          overlaps++;
          if (overlaps <= 8) hits.push("text overlap \\"" + a.t + "\\" x \\"" + c.t + "\\"");
        }
      }
    }
    document.querySelectorAll(".ori-day").forEach((day) => {
      let prev = -1;
      let sawUntimed = false;
      const head = (day.querySelector(".ori-dom") || {}).textContent || "";
      day.querySelectorAll(".ori-ev").forEach((el) => {
        const text = (el.textContent || "").replace(/\\s+/g, " ").trim();
        const raw = el.getAttribute("data-min");
        if (/specials/i.test(text) && /\\d{1,2}:\\d{2}/.test(text)) hits.push("untimed special has a clock " + text.slice(0, 60));
        if (raw == null || raw === "") {
          sawUntimed = true;
          return;
        }
        if (sawUntimed) hits.push("untimed before timed " + head.trim() + " " + text.slice(0, 40));
        const mins = +raw;
        if (mins < prev) hits.push("day out of order " + head.trim() + " " + text.slice(0, 48));
        prev = mins;
      });
    });
    const allDayRows = {};
    document.querySelectorAll(".ori-day .ori-ev").forEach((el) => {
      const text = (el.textContent || "").replace(/\\s+/g, " ").trim();
      if (!/kids with dan|johnson kids|dan nashville|hayes bb|coach should reach|coach in/i.test(text)) return;
      allDayRows[text] = (allDayRows[text] || 0) + 1;
    });
    Object.keys(allDayRows).forEach((title) => {
      if (allDayRows[title] > 1) hits.push("all-day row repeats " + allDayRows[title] + " " + title.slice(0, 60));
    });
  }
  const pending = [...document.querySelectorAll(".light-pad.is-pending, .light-pad.is-need-connect, [data-unconnected-summary]")].filter(shown);
  if (pending.length > 1) hits.push("unconnected cards " + pending.length);
  pending.forEach((el) => {
    const name = el.querySelector(".light-pad-name");
    if (!name) return;
    const t = (name.textContent || "").replace(/\\s+/g, " ").trim();
    if (!t || /not connected yet/i.test(t)) hits.push("nameless unconnected card");
  });
  const unconnectedHits = ((document.body.innerText || "").match(/NOT CONNECTED YET/gi) || []).length;
  if (unconnectedHits > 1) hits.push("unconnected text repeated " + unconnectedHits);
  document.querySelectorAll("button, a, .ftr-chip, .home-btn").forEach((el) => {
    if (!shown(el)) return;
    const s = getComputedStyle(el);
    const bgm = (s.backgroundColor || "").match(/rgba?\\(([^)]+)\\)/);
    const fgm = (s.color || "").match(/rgba?\\(([^)]+)\\)/);
    if (!bgm || !fgm) return;
    const b = bgm[1].split(",").map((n) => parseFloat(n));
    const f = fgm[1].split(",").map((n) => parseFloat(n));
    const ba = b.length >= 4 ? b[3] : 1;
    if (ba < 0.85) return;
    if (b[0] >= 236 && b[1] >= 236 && b[2] >= 236 && f[0] <= 40 && f[1] <= 40 && f[2] <= 40) {
      hits.push("unstyled button " + (ownText(el) || el.getAttribute("aria-label") || el.className || el.tagName).toString().replace(/\\s+/g, " ").slice(0, 48));
    }
  });
  return [...new Set(hits)];
})()`;

function edgeRuns(png, label, dpr) {
  const tmp = "/tmp/ori-edge-" + label.replace(/[^\w.-]+/g, "-") + ".png";
  fs.writeFileSync(tmp, png);
  const edge = Math.max(4, Math.round(4 * (dpr || 1)));
  const py = [
    "from PIL import Image",
    "im = Image.open(" + JSON.stringify(tmp) + ").convert('RGB')",
    "w,h = im.size",
    "px = im.load()",
    "edge = " + edge,
    "minrun = max(24, int(h * 0.12))",
    "def pure(rgb):",
    "    r,g,b = rgb",
    "    if r==255 and g==255 and b==255: return 'white'",
    "    if r==0 and g==0 and b==0: return 'black'",
    "    return ''",
    "def run(xs, ys):",
    "    worst = {}",
    "    for x in xs:",
    "        name=''; count=0",
    "        for y in ys:",
    "            k = pure(px[x,y])",
    "            if k and k==name: count += 1",
    "            else:",
    "                if name and count>=minrun: worst[name]=max(worst.get(name,0), count)",
    "                name, count = k, (1 if k else 0)",
    "        if name and count>=minrun: worst[name]=max(worst.get(name,0), count)",
    "    return worst",
    "out=[]",
    "for side, xs in (",
    "    ('left', range(min(edge,w))),",
    "    ('right', range(max(0,w-edge), w)),",
    "):",
    "    bad=run(xs, range(h))",
    "    out += [f'{side} {k} run {v}' for k,v in bad.items()]",
    "print(' | '.join(out) if out else 'clean')"
  ].join("\n");
  const res = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  return (res.stdout || "").trim() || ("error " + (res.stderr || "").slice(0, 180));
}

function analyzeVideo(file) {
  const W = 48, H = 104, FPS = 60;
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-v", "error", "-i", file,
      "-vf", "fps=" + FPS + ",scale=" + W + ":" + H + ":flags=area",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"
    ]);
    const chunks = [];
    let err = "";
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error(err || "ffmpeg exit " + code));
      const buf = Buffer.concat(chunks);
      const frame = W * H * 3;
      const n = Math.floor(buf.length / frame);
      const diffs = [];
      const lum = [];
      const veil = [];
      for (let i = 0; i < n; i++) {
        const a = i * frame;
        let lv = 0;
        let ls = 0;
        let s = 0;
        const b = a - frame;
        for (let p = 0; p < frame; p += 3) {
          const r = buf[a + p], g = buf[a + p + 1], bl = buf[a + p + 2];
          lv += r + g + bl;
          ls += 3;
          if (i > 0) s += Math.abs(r - buf[b + p]) + Math.abs(g - buf[b + p + 1]) + Math.abs(bl - buf[b + p + 2]);
        }
        lum.push(lv / ls);
        diffs.push(i > 0 ? s / frame : 0);
        let veilPx = 0;
        for (let p = 0; p < frame; p += 3) {
          const r = buf[a + p], g = buf[a + p + 1], bl = buf[a + p + 2];
          if (Math.abs(r - 6) < 14 && Math.abs(g - 32) < 14 && Math.abs(bl - 24) < 14) veilPx++;
        }
        veil.push(veilPx / (W * H));
      }
      resolve({ n, fps: FPS, diffs, lum, veil, duration: n / FPS });
    });
  });
}

function reportVideo(info, failures) {
  const { diffs, lum, veil, fps } = info;
  const n = lum.length;
  const at = (sec) => Math.max(0, Math.min(diffs.length - 1, Math.round(sec * fps)));
  const idle = diffs.slice(at(0.4), at(2.4));
  const idleMean = idle.reduce((s, v) => s + v, 0) / Math.max(1, idle.length);
  const idleMax = idle.reduce((m, v) => Math.max(m, v), 0);
  console.log("  video idle 0.40-2.40s mean-diff " + idleMean.toFixed(2) + " max " + idleMax.toFixed(2) + " frames " + idle.length + " @" + fps + "fps");
  const MOTION_MIN = 0.8;
  if (idleMean < MOTION_MIN) failures.push("video idle mean-diff " + idleMean.toFixed(2) + " under " + MOTION_MIN);

  /* A page change is a hold on the flat veil colour (#062018, the same pixels
     the capture paints between documents), with a blend in and a blend out.
     A blend step moves the picture toward one colour, so its frame diff stays
     near the luminance change. Scrolls and the living map do not. */
  const JUMP_MAX = 16;
  function isHold(i) {
    return lum[i] < 22.5 && veil[i] > 0.92;
  }
  function isBlend(i) {
    if (i <= 0) return false;
    const dl = Math.abs(lum[i] - lum[i - 1]);
    if (diffs[i] < 2) return true;
    return dl > 0.35 && diffs[i] < dl * 1.45 + 2.4;
  }
  const holds = [];
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (isHold(i)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      holds.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0) holds.push([start, n - 1]);
  const pages = holds.filter((h) => (h[1] - h[0] + 1) / fps >= 0.12);
  console.log("  video page-changes " + pages.length + " jump-limit " + JUMP_MAX);
  pages.forEach((h, idx) => {
    let a = h[0];
    while (a > 1 && h[0] - a < fps * 0.9 && isBlend(a)) a--;
    let b = h[1];
    while (b < n - 1 && b - h[1] < fps * 0.9 && isBlend(b + 1)) b++;
    let peak = 0;
    let peakAt = a + 1;
    for (let i = a + 1; i <= b; i++) {
      if (diffs[i] > peak) { peak = diffs[i]; peakAt = i; }
    }
    const t0 = (a + 1) / fps;
    const t1 = b / fps;
    const dLum = (lum[b] - lum[Math.min(n - 1, a + 1)]);
    console.log(
      "  video veil " + (idx + 1) + " " + t0.toFixed(2) + "-" + t1.toFixed(2) +
      "s max-jump " + peak.toFixed(2) + " at " + (peakAt / fps).toFixed(2) +
      "s lum " + dLum.toFixed(1) + " hold " + (h[0] / fps).toFixed(2) + "-" + (h[1] / fps).toFixed(2) + "s"
    );
    if (peak > JUMP_MAX) failures.push("video veil " + (idx + 1) + " jump " + peak.toFixed(2) + " at " + (peakAt / fps).toFixed(2) + "s");
  });
  if (pages.length < 4) failures.push("video page-changes " + pages.length + " expected at least 4 veiled transitions");
}

async function prepare(page, file) {
  if (file.startsWith("sheet-index")) {
    await page.waitForFunction(() => {
      const t = document.querySelector("[data-live='leaveby-main'] .time, [data-live='leaveby-main'] .leaveby-dest");
      return t && (t.textContent || "").trim().length > 1;
    }, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => {
      const b = document.querySelector(".ori-pool-hit");
      const p = document.querySelector(".ori-peek");
      if (b && p && !p.classList.contains("is-open")) b.click();
    });
    await new Promise((r) => setTimeout(r, 450));
  }
  if (file.startsWith("month")) {
    await page.waitForFunction(() => {
      const b = document.querySelector("[data-month-banner]");
      return b && (b.textContent || "").indexOf("Loading") < 0;
    }, { timeout: 20000 });
  }
  if (file.startsWith("sheet-lights")) {
    await page.waitForFunction(() => document.querySelector(".light-pad"), { timeout: 20000 });
  }
  await new Promise((r) => setTimeout(r, 400));
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"]
  });
  const failures = [];
  const views = [
    {
      name: "phone",
      width: 440,
      height: 956,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      phone: true
    },
    {
      name: "wall",
      width: 1080,
      height: 1920,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      phone: false
    }
  ];
  try {
    for (const view of views) {
      const page = await browser.newPage();
      await page.setViewport(view);
      if (view.phone) {
        await page.evaluateOnNewDocument(() => {
          function arm() {
            var h = document.documentElement;
            if (h && h.classList) h.classList.add("ori-phone");
            var v = document.querySelector('meta[name="viewport"]');
            if (v && v.getAttribute("content") !== "width=device-width, initial-scale=1, viewport-fit=cover") {
              v.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
            }
          }
          arm();
          var mo = new MutationObserver(arm);
          mo.observe(document, { childList: true, subtree: true });
          document.addEventListener("DOMContentLoaded", function () { arm(); mo.disconnect(); });
        });
      }
      if (!view.phone) {
        await page.evaluateOnNewDocument(() => {
          var wall = { width: 1080, height: 1920, availWidth: 1080, availHeight: 1920, colorDepth: 24, pixelDepth: 24 };
          try { Object.defineProperty(window, "screen", { configurable: true, get: function () { return wall; } }); } catch (e) {}
        });
      }
      page.on("pageerror", (e) => console.log("PAGE", view.name, e.message));
      for (const file of PAGES) {
        const url = "http://127.0.0.1:" + PORT + "/" + file;
        console.log("check", view.name, file);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
        await prepare(page, file);
        const hits = await page.evaluate((src) => (0, eval)(src), SCAN);
        if (hits.length) {
          for (const h of hits) failures.push(view.name + " " + file + " :: " + h);
        } else {
          console.log("  clean", view.name, file);
        }
        if (view.phone) {
          await page.evaluate(() => scrollTo(0, 0));
          const png = await page.screenshot({ type: "png" });
          const edge = edgeRuns(png, view.name + "-" + file + "-top", view.deviceScaleFactor);
          console.log("  edge", file, "top", edge);
          if (edge !== "clean") failures.push("edge " + view.name + " " + file + " top " + edge);
          if (file !== "sheet-index.html") {
            await page.evaluate(() => scrollTo(0, Math.max(0, document.documentElement.scrollHeight - innerHeight)));
            await new Promise((r) => setTimeout(r, 200));
            const pngBot = await page.screenshot({ type: "png" });
            const edgeBot = edgeRuns(pngBot, view.name + "-" + file + "-bot", view.deviceScaleFactor);
            console.log("  edge", file, "bottom", edgeBot);
            if (edgeBot !== "clean") failures.push("edge " + view.name + " " + file + " bottom " + edgeBot);
            await page.evaluate(() => scrollTo(0, 0));
          }
        }
      }
      if (view.phone) {
        async function veilAt(where) {
          return page.evaluate(() => {
            const root = document.documentElement;
            const held = root.classList.contains("ori-arriving") || root.classList.contains("ori-held");
            let best = null;
            document.querySelectorAll(".ori-iris, .ori-arrive").forEach((el) => {
              const s = getComputedStyle(el);
              const op = parseFloat(s.opacity) || 0;
              const r = el.getBoundingClientRect();
              if (!best || op > best.op) best = { op: op, w: r.width, h: r.height, display: s.display, name: el.className };
            });
            if (best && best.op >= 0.35) return best;
            if (held) return { op: 1, w: innerWidth, h: innerHeight, display: "pseudo", name: "held" };
            return best;
          }).then((mid) => {
            const ok = mid && mid.display !== "none" && mid.op >= 0.35 && mid.w >= view.width - 4 && mid.h >= view.height - 4;
            if (!ok) failures.push("phone veil missing " + where + " " + JSON.stringify(mid));
            else console.log("  veil", where, mid.op.toFixed(2));
          });
        }
        console.log("check phone veil");
        await page.goto("http://127.0.0.1:" + PORT + "/sheet-index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
        await prepare(page, "sheet-index.html");
        await page.evaluate(() => {
          const a = document.querySelector("a.tile.month");
          if (a) a.click();
        });
        await new Promise((r) => setTimeout(r, 280));
        await veilAt("home-to-month");
        await page.waitForFunction(() => /month\.html/.test(location.pathname) && document.documentElement.getAttribute("data-ori-veil") === "1", { timeout: 8000 }).catch((err) => console.log("  arrive-month wait", err.message));
        await veilAt("arrive-month");
        await page.evaluate(() => history.back());
        await page.waitForFunction(() => /sheet-index\.html/.test(location.pathname), { timeout: 8000 }).catch((err) => {
          failures.push("phone back did not return home " + err.message);
        });
        await new Promise((r) => setTimeout(r, 160));
        await veilAt("back-home");
        await page.goto("http://127.0.0.1:" + PORT + "/sheet-index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
        await prepare(page, "sheet-index.html");
        await page.evaluate(() => {
          const a = document.querySelector("a.hub-lights-more");
          if (a) a.click();
        });
        await new Promise((r) => setTimeout(r, 280));
        await veilAt("home-to-lights");
        await page.waitForFunction(() => /sheet-lights\.html/.test(location.pathname) && document.documentElement.getAttribute("data-ori-veil") === "1", { timeout: 8000 }).catch((err) => console.log("  arrive-lights wait", err.message));
        await veilAt("arrive-lights");
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const clip = process.env.ORI_CLIP || "/opt/cursor/artifacts/ori-run9/home-phone-overworld-hq.mp4";
  if (fs.existsSync(clip)) {
    console.log("check video", clip);
    try {
      const info = await analyzeVideo(clip);
      console.log("  video frames " + info.n + " duration " + info.duration.toFixed(2) + "s");
      reportVideo(info, failures);
    } catch (err) {
      failures.push("video analyze " + err.message);
    }
  } else if (process.env.ORI_REQUIRE_VIDEO === "1") {
    failures.push("video missing " + clip);
  } else {
    console.log("check video skipped (no clip yet)");
  }
  const stillDir = path.dirname(clip);
  const stills = [
    "home-map-phone.jpg", "pool-open-phone.jpg", "month-top-phone.jpg",
    "month-scrolled-phone.jpg", "lights-top-phone.jpg", "lights-bottom-phone.jpg"
  ];
  for (const name of stills) {
    const file = path.join(stillDir, name);
    if (!fs.existsSync(file)) {
      if (process.env.ORI_REQUIRE_VIDEO === "1") failures.push("still missing " + file);
      continue;
    }
    const edge = edgeRuns(fs.readFileSync(file), "still-" + name, 1);
    console.log("  still edge", name, edge);
    if (edge !== "clean") failures.push("still edge " + name + " " + edge);
  }
  if (failures.length) {
    console.error("GATE 3 FAIL " + failures.length);
    for (const f of failures) console.error(" - " + f);
    process.exit(1);
  }
  console.log("GATE 3 PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
