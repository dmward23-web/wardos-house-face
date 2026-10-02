/* NICEONE1 · scripts/house/parent-pin-store.mjs · hub-side parent PIN (Wright, Dan's chore law Oct 1 8:01 PM CT).
   The PIN lives ONLY on the hub: ~/.config/wardos/parent-pin.json (mode 600, never in git; .gitignore + wall-guards check).
   Stored as a salted scrypt hash (node:crypto). The browser never sees the PIN hash; it only gets {pinSet, bookReady}.
   Lockout: 5 wrong PINs lock verify for 10 minutes. The lock is persisted next to the PIN (parent-pin-lock.json, mode 600),
   so restarting the proxy doesn't reset it. Compare is constant-time (crypto.timingSafeEqual on equal-length keys). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const PIN_RE = /^\d{4}$/;
export const MAX_FAILS = 5;
export const LOCK_MS = 10 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export function configDir(home = os.homedir()) { return path.join(home, ".config", "wardos"); }
export function pinPaths(dir = configDir()) {
  return { dir, pin: path.join(dir, "parent-pin.json"), lock: path.join(dir, "parent-pin-lock.json") };
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
function writeJson600(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, p);
  fs.chmodSync(p, 0o600);
}
function derive(pin, salt, prm = SCRYPT) {
  return crypto.scryptSync(String(pin), salt, prm.keylen, { N: prm.N, r: prm.r, p: prm.p, maxmem: 64 * 1024 * 1024 });
}
/** -> record written to parent-pin.json. Throws on a PIN that is not exactly 4 digits. */
export function hashPin(pin, now = Date.now()) {
  if (!PIN_RE.test(String(pin))) throw new Error("PIN must be exactly 4 digits");
  const salt = crypto.randomBytes(16);
  return { v: 1, algo: "scrypt", N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, keylen: SCRYPT.keylen,
    salt: salt.toString("base64"), hash: derive(pin, salt).toString("base64"), setAt: new Date(now).toISOString() };
}
function validRecord(rec) {
  return !!rec && rec.v === 1 && rec.algo === "scrypt" && typeof rec.salt === "string" && typeof rec.hash === "string"
    && [rec.N, rec.r, rec.p, rec.keylen].every((x) => Number.isInteger(x) && x > 0);
}
/** constant-time: always derives, always compares equal-length buffers. */
export function checkPin(rec, pin) {
  if (!validRecord(rec)) return false;
  const want = Buffer.from(rec.hash, "base64");
  const got = derive(PIN_RE.test(String(pin)) ? String(pin) : "x" + String(pin), Buffer.from(rec.salt, "base64"), rec);
  return want.length === got.length && crypto.timingSafeEqual(want, got) && PIN_RE.test(String(pin));
}

export function createPinStore({ dir = configDir(), now = () => Date.now() } = {}) {
  const P = pinPaths(dir);
  const readLock = () => { const l = readJson(P.lock); return l && typeof l === "object" ? { fails: Number(l.fails) || 0, lockedUntil: Number(l.lockedUntil) || 0 } : { fails: 0, lockedUntil: 0 }; };
  return {
    paths: P,
    isSet() { return validRecord(readJson(P.pin)); },
    set(pin) { writeJson600(P.pin, hashPin(pin, now())); try { fs.rmSync(P.lock, { force: true }); } catch { /* */ } return true; },
    clear() { let had = false; for (const f of [P.pin, P.lock]) { if (fs.existsSync(f)) had = true; fs.rmSync(f, { force: true }); } return had; },
    lockState() { const l = readLock(); const t = now(); return { locked: l.lockedUntil > t, retryAfterMs: Math.max(0, l.lockedUntil - t), fails: l.lockedUntil > t ? l.fails : (l.lockedUntil ? 0 : l.fails) }; },
    /** -> {ok:true} | {ok:false, error:"not-configured"|"locked"|"wrong-pin", retryAfterMs?, triesLeft?} */
    verify(pin) {
      const rec = readJson(P.pin);
      if (!validRecord(rec)) return { ok: false, error: "not-configured" };
      const t = now();
      let l = readLock();
      if (l.lockedUntil > t) return { ok: false, error: "locked", retryAfterMs: l.lockedUntil - t };
      if (l.lockedUntil && l.lockedUntil <= t) l = { fails: 0, lockedUntil: 0 }; /* lock served: fresh 5 tries */
      if (checkPin(rec, pin)) { fs.rmSync(P.lock, { force: true }); return { ok: true }; }
      l.fails += 1;
      if (l.fails >= MAX_FAILS) { l.lockedUntil = t + LOCK_MS; writeJson600(P.lock, l); return { ok: false, error: "locked", retryAfterMs: LOCK_MS }; }
      writeJson600(P.lock, l);
      return { ok: false, error: "wrong-pin", triesLeft: MAX_FAILS - l.fails };
    },
  };
}
