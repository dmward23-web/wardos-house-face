/* NICEONE1 · scripts/house/nice-one.mjs · hub-side parent gate for the wall's "Nice one" (Wright).
   CHORE LAW (Dan, Oct 1 8:01 PM CT): the jar pays TIME and PICKS, never cash. Ledger's book (house-jar.js, JAR1) writes
   client-side (per-device queue, SHARED_WRITE_ENABLED=false), so the hub does NOT write any book: it only verifies the PIN
   and hands out one short-lived, single-use grant. Mounted in scripts/lights-write-proxy.mjs AFTER its checkAuth gate
   (same hub key + auth as the Sensi/Kasa routes): no key -> 401 before anything here runs.
     GET  /api/nice-one/status   -> {pinSet}                                   (nothing else: no hash, no tries, no lock)
     POST /api/nice-one/verify   {pin}              -> {ok, grantToken, expiresIn:60}   (PIN checked HERE, never in a browser)
     POST /api/nice-one/consume  {grantToken, tapId, action}  -> {ok, tapId, duplicate?}  action: nice-one | redeem | reverse
     POST /api/nice-one/check    {grantToken}       -> {ok}   valid + unexpired + unused; does not spend it (parent view)
   Rules: no PIN set -> 503 not-configured (no attempt spent). 5 wrong PINs -> locked 10 min, persisted across restarts
   (parent-pin-store). Each verify allows exactly ONE consume within 60 s. tapId (uuid) is idempotent: a resync of a
   consumed tapId answers {ok, duplicate:true} and never spends another grant. Token compare is constant-time. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createPinStore, configDir } from "./parent-pin-store.mjs";

export const GRANT_SEC = 60;
export const ACTIONS = ["nice-one", "redeem", "reverse"];
export const TAP_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEEP_TAPS = 500;

export function createNiceOne({ dir = configDir(), now = () => Date.now(), pins = createPinStore({ dir, now }),
  newToken = () => crypto.randomBytes(24).toString("base64url") } = {}) {
  const tapsFile = path.join(dir, "nice-one-taps.json");
  let grant = null; /* {token, exp, used:false} · in memory only: a restart drops it (the parent just re-enters the PIN) */
  const loadTaps = () => { try { const j = JSON.parse(fs.readFileSync(tapsFile, "utf8")); return j && typeof j === "object" ? j : {}; } catch { return {}; } };
  const saveTaps = (t) => {
    const keys = Object.keys(t); if (keys.length > KEEP_TAPS) for (const k of keys.slice(0, keys.length - KEEP_TAPS)) delete t[k];
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = tapsFile + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(t), { mode: 0o600 }); fs.chmodSync(tmp, 0o600); fs.renameSync(tmp, tapsFile);
  };
  const R = (status, body) => ({ status, body });
  const sameToken = (t) => { const a = Buffer.from(String(t || "")), b = Buffer.from(grant ? grant.token : ""); return !!grant && a.length === b.length && crypto.timingSafeEqual(a, b); };
  /* -> null when usable, else the refusal */
  function tokenProblem(t) {
    if (!pins.isSet()) return R(503, { ok: false, error: "not-configured" });
    if (!sameToken(t)) return R(403, { ok: false, error: "no-grant" });
    if (now() > grant.exp) { grant = null; return R(403, { ok: false, error: "grant-expired" }); }
    if (grant.used) return R(403, { ok: false, error: "grant-used" });
    return null;
  }

  function verify(body) {
    if (!pins.isSet()) return R(503, { ok: false, error: "not-configured" });
    const v = pins.verify(body && body.pin);
    if (!v.ok && v.error === "locked") return R(423, { ok: false, error: "locked", retryAfterSec: Math.ceil(v.retryAfterMs / 1000) });
    if (!v.ok && v.error === "not-configured") return R(503, { ok: false, error: "not-configured" });
    if (!v.ok) return R(403, { ok: false, error: "wrong-pin", triesLeft: v.triesLeft });
    grant = { token: newToken(), exp: now() + GRANT_SEC * 1000, used: false }; /* a new unlock replaces any unused one */
    return R(200, { ok: true, grantToken: grant.token, expiresIn: GRANT_SEC });
  }

  function consume(body) {
    const b = body || {};
    const tapId = String(b.tapId || "");
    if (!TAP_ID_RE.test(tapId)) return R(400, { ok: false, error: "tapId must be a uuid" });
    if (!ACTIONS.includes(b.action)) return R(400, { ok: false, error: "action must be nice-one, redeem or reverse" });
    const done = loadTaps();
    if (done[tapId]) return R(200, { ok: true, duplicate: true, tapId, action: done[tapId].action });
    const bad = tokenProblem(b.grantToken); if (bad) return bad;
    grant.used = true; /* the one grant for this unlock is spent */
    done[tapId] = { action: b.action, at: new Date(now()).toISOString() };
    saveTaps(done);
    return R(200, { ok: true, tapId, action: b.action });
  }

  function check(body) { return tokenProblem(body && body.grantToken) || R(200, { ok: true, expiresIn: Math.max(0, Math.ceil((grant.exp - now()) / 1000)) }); }

  /** -> {status, body} for a nice-one path, else null (the proxy carries on to its other routes). */
  async function handle(pathname, method, body) {
    const want = (m, fn) => (method === m ? fn() : R(405, { ok: false, error: m + " only" }));
    if (pathname === "/api/nice-one/status") return want("GET", () => R(200, { pinSet: pins.isSet() }));
    if (pathname === "/api/nice-one/verify") return want("POST", () => verify(body));
    if (pathname === "/api/nice-one/consume") return want("POST", () => consume(body));
    if (pathname === "/api/nice-one/check") return want("POST", () => check(body));
    return null;
  }
  return { handle };
}
