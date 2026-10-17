/**
 * ACCESSLOG · one JSON line per request for the house proxies (cams :8787, lights :8788).
 *
 *   ~/.cache/wardos/<name>-access.log   file 600, directory 700, never inside the repo
 *   {"t":"2026-10-17T07:30:00.123-05:00","m":"GET","p":"/api/cameras","s":200,"slot":"device","ip":"203.0.113.9","ua":"..."}
 *
 * - p is the route path only: no query string, no fragment. A path segment (or the UA) that carries a loaded key is
 *   replaced with <redacted>, so a key pasted into a URL or header never reaches the file.
 * - slot says WHICH credential matched (device | retired | pair | none), never the value or a hash of it.
 * - ip is cf-connecting-ip as Cloudflare sets it at the edge (shape-checked; anything else logs "invalid");
 *   "-" when absent (loopback callers, tests). X-Forwarded-For is never logged (client-controlled).
 * - ua is trimmed to 120 chars, control characters stripped.
 * - Rotation at 5 MB (<name>-access.log.1 .. .3, the oldest dropped). WARDOS_ACCESS_LOG_MAX_BYTES overrides (tests).
 * - WARDOS_ACCESS_LOG_DIR overrides the directory (tests). A directory inside the repo is refused (logging off).
 * - A logging failure never breaks a request: every step is guarded and the request has already been answered.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ACCESS_LOG_MAX_BYTES = 5 * 1024 * 1024;
export const ACCESS_LOG_KEEP = 3;
export const SLOTS = new Set(["device", "retired", "pair", "none"]);

/** local ISO time with the UTC offset, e.g. 2026-10-17T07:30:00.123-05:00 */
export function isoLocal(d = new Date()) {
  const p = (n, w = 2) => String(Math.abs(Math.trunc(n))).padStart(w, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}${sign}${p(off / 60)}:${p(off % 60)}`;
}

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9A-Fa-f:.]{2,45}$/;
export function cleanIp(v) {
  if (v == null || v === "") return "-";
  const s = String(v).split(",")[0].trim();
  return (IPV4.test(s) || (s.includes(":") && IPV6.test(s))) ? s : "invalid";
}

/** remove every occurrence of a secret (raw or URL-encoded) from s */
export function scrub(s, secrets) {
  let out = String(s == null ? "" : s);
  for (const k of secrets || []) {
    if (!k || k.length < 8) continue;
    for (const form of new Set([k, encodeURIComponent(k)])) {
      if (out.includes(form)) out = out.split(form).join("<redacted>");
    }
  }
  return out;
}

/** route path only: no query, no fragment; any segment carrying a secret (raw or percent-encoded) is <redacted> */
export function cleanPath(rawUrl, secrets) {
  let p = String(rawUrl || "/");
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  if (!p.startsWith("/")) { p = p.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, ""); if (!p.startsWith("/")) p = "/" + p; }
  const segs = p.split("/").map((seg) => {
    let dec = seg;
    try { dec = decodeURIComponent(seg); } catch { /* keep raw */ }
    for (const k of secrets || []) if (k && k.length >= 8 && (seg.includes(k) || dec.includes(k))) return "<redacted>";
    return seg;
  });
  p = segs.join("/");
  if (p.length > 200) p = p.slice(0, 200) + "...";
  return p;
}

export function cleanUa(v, secrets) {
  const s = scrub(String(v == null ? "" : v), secrets).replace(/[\x00-\x1f\x7f]/g, " ");
  return s.length > 120 ? s.slice(0, 120) : s;
}

function insideRepo(dir) {
  const rel = path.relative(REPO, dir);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * createAccessLog({ name, secrets: () => string[] }) → { attach(req, res), setSlot(req, slot), file, enabled }
 * attach() records the request once the response finishes (or the socket closes first).
 */
export function createAccessLog({ name, secrets = () => [], env = process.env } = {}) {
  const dir = path.resolve(env.WARDOS_ACCESS_LOG_DIR || path.join(os.homedir(), ".cache", "wardos"));
  const file = path.join(dir, `${name}-access.log`);
  const maxBytes = Math.max(256, Number(env.WARDOS_ACCESS_LOG_MAX_BYTES) || ACCESS_LOG_MAX_BYTES);
  let enabled = true, warned = false, dirReady = false;
  const warn = (msg) => { if (!warned) { warned = true; try { console.warn(`[access-log] ${name}: ${msg} (access logging degraded; requests unaffected)`); } catch { /* */ } } };
  if (insideRepo(dir)) { enabled = false; warn("refusing a log directory inside the repo"); }

  function ensureDir() {
    if (dirReady) return;
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const st = fs.statSync(dir);
    if ((st.mode & 0o777) !== 0o700 && st.uid === process.getuid?.()) fs.chmodSync(dir, 0o700);
    dirReady = true;
  }
  function rotate() {
    for (let i = ACCESS_LOG_KEEP; i >= 1; i--) {
      const src = i === 1 ? file : `${file}.${i - 1}`;
      const dst = `${file}.${i}`;
      try { if (i === ACCESS_LOG_KEEP) fs.rmSync(dst, { force: true }); } catch { /* */ }
      try { fs.renameSync(src, dst); } catch { /* missing is fine */ }
    }
  }
  function write(line) {
    if (!enabled) return;
    try {
      ensureDir();
      let size = 0;
      try { size = fs.statSync(file).size; } catch { /* new file */ }
      if (size > 0 && size + Buffer.byteLength(line) > maxBytes) rotate();
      const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW || 0), 0o600);
      try {
        try { fs.fchmodSync(fd, 0o600); } catch { /* */ }
        fs.writeSync(fd, line);
      } finally { fs.closeSync(fd); }
    } catch (e) {
      warn(e && e.code ? e.code : "write failed");
    }
  }
  const SLOT = Symbol("accessSlot");
  function setSlot(req, slot) { try { if (SLOTS.has(slot)) req[SLOT] = slot; } catch { /* */ } }
  function attach(req, res) {
    try {
      let done = false;
      const rec = () => {
        if (done) return; done = true;
        try {
          let ks = [];
          try { ks = (secrets() || []).filter(Boolean).map(String); } catch { ks = []; }
          const status = res.writableFinished || res.headersSent ? res.statusCode : 0;
          const entry = {
            t: isoLocal(),
            m: String(req.method || "-").slice(0, 10),
            p: cleanPath(req.url, ks),
            s: status,
            slot: req[SLOT] || "none",
            ip: cleanIp(req.headers && req.headers["cf-connecting-ip"]),
            ua: cleanUa(req.headers && req.headers["user-agent"], ks),
          };
          write(JSON.stringify(entry) + "\n");
        } catch (e) { warn("record failed"); }
      };
      res.once("finish", rec);
      res.once("close", rec);
    } catch { /* never break the request */ }
  }
  return { attach, setSlot, file, get enabled() { return enabled; } };
}
