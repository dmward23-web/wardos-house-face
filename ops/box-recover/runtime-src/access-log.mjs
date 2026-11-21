/**
 * ACCESSLOG · one JSON line per request for the house proxies (cams :8787, lights :8788).
 *
 *   ~/.cache/wardos/<name>-access.log   file 600, directory 700, never inside the repo
 *   {"t":"2026-10-17T07:30:00.123-05:00","m":"GET","p":"/api/cameras","s":200,"slot":"device","ip":"203.0.113.9","ua":"..."}
 *
 * - p is the route path only: no query string, no fragment. A path segment (or the UA) that carries a loaded key is
 *   replaced with <redacted>, so a key pasted into a URL or header never reaches the file.
 * - slot says WHICH credential matched (device | retired | pair | none), never the value or a hash of it.
 * - ip is cf-connecting-ip (shape-checked; anything else logs "invalid"); "-" when absent. X-Forwarded-For is never
 *   logged (client-controlled). TRUST: only tunnel traffic gets cf-connecting-ip set by the Cloudflare edge. A loopback
 *   or direct client sets the header itself, so for those callers the ip is whatever they sent (a forged value logs as given).
 * - FOLLOWUP1 redaction: the scrub set is EVERY house key file (nest-device, nest-proxy, lights-proxy, private-feed under
 *   ~/.config/wardos, plus NEST_PROXY_TOKEN / LIGHTS_PROXY_TOKEN), not just the keys this proxy loaded, matched raw and
 *   percent-encoded in any letter case; any base64url-looking run of 20+ chars with mixed character classes in a path
 *   segment or the UA is <redacted> too.
 * - Retention: lines older than 30 days are dropped from the log and its rotations (checked at the first write and then
 *   hourly). WARDOS_ACCESS_LOG_MAX_DAYS overrides (tests).
 * - A logging failure warns again at most every 10 minutes (with a count), never only once.
 * - ua is trimmed to 120 chars, control characters stripped.
 * - Rotation at 5 MB (<name>-access.log.1 .. .3, the oldest dropped). WARDOS_ACCESS_LOG_MAX_BYTES overrides (tests).
 * - WARDOS_ACCESS_LOG_DIR overrides the directory (tests). A directory whose REAL path is inside the repo, or that is a
 *   symlink, is refused (logging off). Rotated files are forced to 600 as well.
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

/* FOLLOWUP1 · every house key file, whichever proxy loaded it (values never leave this module) */
export const HOUSE_KEY_FILES = ["nest-device.token", "nest-proxy.token", "lights-proxy.token", "private-feed.token"];
export function houseKeyScrubSet(env = process.env, home = os.homedir()) {
  const out = new Set();
  const add = (t) => { t = String(t || "").trim(); if (t.length >= 8) out.add(t); };
  for (const f of HOUSE_KEY_FILES) {
    try { for (const t of fs.readFileSync(path.join(home, ".config", "wardos", f), "utf8").split(/\s+/)) add(t); } catch { /* missing file */ }
  }
  add(env.NEST_PROXY_TOKEN); add(env.LIGHTS_PROXY_TOKEN);
  return [...out];
}

/* base64url-looking run: 20+ chars of [A-Za-z0-9_-] using at least two of upper, lower, digit */
const B64_RUN = /[A-Za-z0-9_-]{20,}/g;
function mixedRun(r) { return (/[A-Z]/.test(r) ? 1 : 0) + (/[a-z]/.test(r) ? 1 : 0) + (/[0-9]/.test(r) ? 1 : 0) >= 2; }
export function redactRuns(s) { return String(s).replace(B64_RUN, (r) => (mixedRun(r) ? "<redacted>" : r)); }
function hasRun(s) { return (String(s).match(B64_RUN) || []).some(mixedRun); }
const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function keyForms(k) { return [...new Set([k, encodeURIComponent(k)])]; }

/** remove every occurrence of a secret (raw or URL-encoded, any letter case) from s */
export function scrub(s, secrets) {
  let out = String(s == null ? "" : s);
  for (const k of secrets || []) {
    if (!k || k.length < 8) continue;
    for (const form of keyForms(k)) out = out.replace(new RegExp(reEsc(form), "gi"), "<redacted>");
  }
  return out;
}

/** route path only: no query, no fragment; any segment carrying a secret (raw or percent-encoded, any case) or a
    base64url-looking run is <redacted> */
export function cleanPath(rawUrl, secrets) {
  let p = String(rawUrl || "/");
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  if (!p.startsWith("/")) { p = p.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, ""); if (!p.startsWith("/")) p = "/" + p; }
  const ks = (secrets || []).filter((k) => k && k.length >= 8).map((k) => String(k).toLowerCase());
  const segs = p.split("/").map((seg) => {
    let dec = seg;
    try { dec = decodeURIComponent(seg); } catch { /* keep raw */ }
    const a = seg.toLowerCase(), b = dec.toLowerCase();
    for (const k of ks) if (a.includes(k) || b.includes(k) || a.includes(encodeURIComponent(k).toLowerCase())) return "<redacted>";
    if (hasRun(seg) || hasRun(dec)) return "<redacted>";
    return seg;
  });
  p = segs.join("/");
  if (p.length > 200) p = p.slice(0, 200) + "...";
  return p;
}

export function cleanUa(v, secrets) {
  const s = redactRuns(scrub(String(v == null ? "" : v), secrets)).replace(/[\x00-\x1f\x7f]/g, " ");
  return s.length > 120 ? s.slice(0, 120) : s;
}

/* FOLLOWUP1 · compare REAL paths: a symlink (or a symlinked parent) into the repo is still inside it */
function realish(p) {
  let cur = path.resolve(p); const rest = [];
  for (;;) {
    try { return path.join(fs.realpathSync(cur), ...rest.reverse()); } catch { /* not there yet */ }
    const up = path.dirname(cur);
    if (up === cur) return path.resolve(p);
    rest.push(path.basename(cur)); cur = up;
  }
}
let REPO_REAL = REPO; try { REPO_REAL = fs.realpathSync(REPO); } catch { /* keep */ }
export function insideRepo(dir) {
  for (const [d, r] of [[path.resolve(dir), REPO], [realish(dir), REPO_REAL]]) {
    const rel = path.relative(r, d);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) return true;
  }
  return false;
}
function isSymlink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }
export const ACCESS_LOG_MAX_DAYS = 30;

/**
 * createAccessLog({ name, secrets: () => string[] }) → { attach(req, res), setSlot(req, slot), file, enabled }
 * attach() records the request once the response finishes (or the socket closes first).
 */
export function createAccessLog({ name, secrets = () => [], env = process.env } = {}) {
  const dir = path.resolve(env.WARDOS_ACCESS_LOG_DIR || path.join(os.homedir(), ".cache", "wardos"));
  const file = path.join(dir, `${name}-access.log`);
  const maxBytes = Math.max(256, Number(env.WARDOS_ACCESS_LOG_MAX_BYTES) || ACCESS_LOG_MAX_BYTES);
  const maxDays = Number(env.WARDOS_ACCESS_LOG_MAX_DAYS) > 0 ? Number(env.WARDOS_ACCESS_LOG_MAX_DAYS) : ACCESS_LOG_MAX_DAYS;
  const WARN_EVERY_MS = Number(env.WARDOS_ACCESS_LOG_WARN_MS) >= 0 && env.WARDOS_ACCESS_LOG_WARN_MS !== undefined ? Number(env.WARDOS_ACCESS_LOG_WARN_MS) : 10 * 60 * 1000;
  const PRUNE_EVERY_MS = 60 * 60 * 1000;
  let enabled = true, dirReady = false, lastWarn = 0, suppressed = 0, lastPrune = 0;
  /* FOLLOWUP1 · repeat the warning (rate limited) so a later failure is never silent */
  const warn = (msg) => {
    const now = Date.now();
    if (lastWarn && now - lastWarn < WARN_EVERY_MS) { suppressed++; return; }
    const more = suppressed ? `; ${suppressed} more since the last warning` : "";
    lastWarn = now; suppressed = 0;
    try { console.warn(`[access-log] ${name}: ${msg} (access logging degraded; requests unaffected${more})`); } catch { /* */ }
  };
  if (insideRepo(dir)) { enabled = false; warn("refusing a log directory inside the repo"); }
  else if (isSymlink(dir)) { enabled = false; warn("refusing a symlinked log directory"); }
  /* FOLLOWUP1 · scrub every house key file, not only the keys this proxy authorises with (re-read at most once a minute) */
  let houseKeys = [], houseAt = 0;
  const scrubSet = () => {
    if (Date.now() - houseAt > 60000) { houseAt = Date.now(); try { houseKeys = houseKeyScrubSet(env); } catch { houseKeys = []; } }
    let own = [];
    try { own = (secrets() || []).filter(Boolean).map(String); } catch { own = []; }
    return [...new Set([...own, ...houseKeys])];
  };

  function ensureDir() {
    if (dirReady) return;
    if (isSymlink(dir) || insideRepo(dir)) { enabled = false; throw Object.assign(new Error("log dir refused"), { code: "EREFUSED" }); }
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const st = fs.lstatSync(dir);
    if (!st.isDirectory()) throw Object.assign(new Error("not a directory"), { code: "ENOTDIR" });
    if ((st.mode & 0o777) !== 0o700 && st.uid === process.getuid?.()) fs.chmodSync(dir, 0o700);
    dirReady = true;
  }
  function tighten(f) {
    try { const st = fs.lstatSync(f); if (st.isFile() && (st.mode & 0o777) !== 0o600) fs.chmodSync(f, 0o600); } catch { /* missing */ }
  }
  function rotate() {
    for (let i = ACCESS_LOG_KEEP; i >= 1; i--) {
      const src = i === 1 ? file : `${file}.${i - 1}`;
      const dst = `${file}.${i}`;
      try { if (i === ACCESS_LOG_KEEP) fs.rmSync(dst, { force: true }); } catch { /* */ }
      try { fs.renameSync(src, dst); } catch { /* missing is fine */ }
    }
    for (let i = 1; i <= ACCESS_LOG_KEEP; i++) tighten(`${file}.${i}`);
  }
  /* FOLLOWUP1 · retention cap: drop lines older than maxDays from the log and every rotation */
  function prune() {
    const cutoff = Date.now() - maxDays * 86400000;
    for (const f of [file, ...Array.from({ length: ACCESS_LOG_KEEP }, (_, i) => `${file}.${i + 1}`)]) {
      try {
        const st = fs.lstatSync(f);
        if (!st.isFile()) continue;
        tighten(f);
        const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
        const keep = lines.filter((l) => { try { const t = Date.parse(JSON.parse(l).t); return !(t < cutoff); } catch { return true; } });
        if (keep.length === lines.length) continue;
        if (!keep.length) { fs.rmSync(f, { force: true }); continue; }
        const tmp = `${f}.prune-${process.pid}`;
        const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
        try { fs.fchmodSync(fd, 0o600); fs.writeSync(fd, keep.join("\n") + "\n"); } finally { fs.closeSync(fd); }
        fs.renameSync(tmp, f);
      } catch { /* missing or unreadable: next */ }
    }
  }
  function write(line) {
    if (!enabled) return;
    try {
      ensureDir();
      if (!lastPrune || Date.now() - lastPrune > PRUNE_EVERY_MS) { lastPrune = Date.now(); prune(); }
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
          const ks = scrubSet();
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
