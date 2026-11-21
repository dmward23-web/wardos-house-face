/**
 * SPOTIFY1 · WardOS House Face · Spotify Connect control (box only)
 *
 * Used by lights-write-proxy.mjs (/api/spotify/*) — same hub key + tunnel as lights / Sensi.
 * The box holds ONE Spotify login for the house (Authorization Code + PKCE, public client:
 * no client secret exists anywhere). Every screen that already has the hub key (phone icon,
 * wall) controls the same Spotify account; Dan connects once, ever.
 *
 * Box-only files (mode 600, never git, never Pages):
 *   ~/.config/wardos/spotify-app.json     { clientId }            (Spotify dev app id · public id, kept here anyway)
 *   ~/.config/wardos/spotify-token.json   { refresh_token, scope, user, savedAt }
 *   ~/.config/wardos/spotify-pending.json pending PKCE logins { state: { verifier, returnTo, at } } (15 min)
 *
 * CLI:
 *   node scripts/spotify-control.mjs status
 *   node scripts/spotify-control.mjs set-client <32-hex client id>
 *   node scripts/spotify-control.mjs state | devices | library
 *   node scripts/spotify-control.mjs do <play|pause|next|previous|volume N|shuffle on|repeat off>
 *   node scripts/spotify-control.mjs browse <kind> [id|query]   (search|liked|playlists|albums|artists|shows|queue|album|artist|playlist|show)
 *   node scripts/spotify-control.mjs disconnect
 *
 * Endpoints follow Spotify's Feb-2026 Development Mode rules (new apps): /me/library for save/remove/contains,
 * /playlists/{id}/items, search limit ≤ 10, no artist top-tracks / batch / browse-category endpoints.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const CFG = path.join(os.homedir(), ".config", "wardos");
const APP_FILE = process.env.SPOTIFY_APP_FILE || path.join(CFG, "spotify-app.json");
const TOKEN_FILE = process.env.SPOTIFY_TOKEN_FILE || path.join(CFG, "spotify-token.json");
const PENDING_FILE = process.env.SPOTIFY_PENDING_FILE || path.join(CFG, "spotify-pending.json");
const ROOMS_FILE = process.env.SPOTIFY_ROOMS_FILE || path.join(path.dirname(TOKEN_FILE), "spotify-rooms.json");
const LOCK_DIR = TOKEN_FILE + ".lock";

export const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || "https://dmward23-web.github.io/wardos-house-face/spotify-callback.html";
export const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-read-collaborative",
  /* SPOTIFY2 · full board: Liked Songs, saved albums / podcasts, like + unlike, followed artists */
  "user-library-read",
  "user-library-modify",
  "user-follow-read",
];
/* *_BASE overrides exist only for the box-side mock test (scripts/qa/spotify-mock.mjs) */
const ACCOUNTS = process.env.SPOTIFY_ACCOUNTS_BASE || "https://accounts.spotify.com";
const API = process.env.SPOTIFY_API_BASE || "https://api.spotify.com/v1";
const RETURN_OK = /^(sheet-spotify\.html|sheet-index\.html)(\?[A-Za-z0-9=&._%-]*)?(#[A-Za-z0-9_-]*)?$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }
function writeJson600(f, obj) {
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
  const tmp = f + ".tmp" + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, f);
  try { fs.chmodSync(f, 0o600); } catch {}
}

export class SpotifyError extends Error {
  constructor(code, message, status, extra) { super(message || code); this.code = code; this.status = status || 0; Object.assign(this, extra || {}); }
}

/* ---------------- app + token storage ---------------- */
export function clientId() {
  const env = (process.env.SPOTIFY_CLIENT_ID || "").trim();
  if (env) return env;
  const j = readJson(APP_FILE);
  return j && typeof j.clientId === "string" ? j.clientId.trim() : "";
}
export function setClientId(id) {
  id = String(id || "").trim();
  if (!/^[0-9a-f]{32}$/i.test(id)) throw new SpotifyError("bad_client_id", "Client ID should be 32 letters/numbers (from the Spotify dashboard).", 400);
  const prev = clientId();
  writeJson600(APP_FILE, { clientId: id.toLowerCase(), setAt: new Date().toISOString() });
  if (prev && prev !== id.toLowerCase()) { try { fs.unlinkSync(TOKEN_FILE); } catch {} _access = null; }
  return { clientId: id.toLowerCase() };
}
function tokenRec() { return readJson(TOKEN_FILE); }
export function connected() { const t = tokenRec(); return !!(t && t.refresh_token && clientId() && t.clientId === clientId()); }
/** scopes the box login is missing (login made before a feature was added) → board offers a one-tap reconnect */
export function missingScopes() {
  const t = tokenRec(); if (!t || !t.scope) return [];
  const have = new Set(String(t.scope).split(/\s+/));
  return SCOPES.filter((x) => !have.has(x));
}

/* ---------------- PKCE login ---------------- */
function loadPending() {
  const p = readJson(PENDING_FILE) || {};
  const now = Date.now();
  for (const k of Object.keys(p)) if (!p[k] || now - (p[k].at || 0) > 15 * 60 * 1000) delete p[k];
  return p;
}
export function authStart(returnTo) {
  const cid = clientId();
  if (!cid) throw new SpotifyError("need_app", "Spotify app not set up on the box yet.", 409);
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(24));
  const p = loadPending();
  p[state] = { verifier, at: Date.now(), returnTo: RETURN_OK.test(String(returnTo || "")) ? String(returnTo) : "sheet-spotify.html" };
  writeJson600(PENDING_FILE, p);
  const q = new URLSearchParams({
    response_type: "code",
    client_id: cid,
    scope: SCOPES.join(" "),
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  return { url: `${ACCOUNTS}/authorize?${q}`, redirectUri: REDIRECT_URI, expiresInSec: 900 };
}
/** Completes a login. Authorised by the single-use, box-minted `state` (no hub key needed — the
 *  callback page may run in a different storage context than the screen that started it). */
export async function authExchange(code, state) {
  if (!state || typeof state !== "string") throw new SpotifyError("bad_state", "Missing login state.", 400);
  const p = loadPending();
  const rec = p[state];
  if (!rec) throw new SpotifyError("bad_state", "That Spotify login link expired. Tap Connect Spotify again.", 400);
  delete p[state];
  writeJson600(PENDING_FILE, p);
  if (!code || typeof code !== "string") throw new SpotifyError("no_code", "Spotify did not send a login code.", 400);
  const cid = clientId();
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: cid, code_verifier: rec.verifier });
  const r = await fetch(`${ACCOUNTS}/api/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) throw new SpotifyError("exchange_failed", `Spotify login failed (${j.error_description || j.error || r.status}).`, 502);
  _access = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  let user = null;
  try { const me = await rawApi("GET", "/me", null, j.access_token); user = me && { id: me.id, name: me.display_name || me.id }; } catch {}
  writeJson600(TOKEN_FILE, { refresh_token: j.refresh_token, scope: j.scope || SCOPES.join(" "), clientId: cid, user, savedAt: new Date().toISOString() });
  _cache = {};
  return { ok: true, user, returnTo: rec.returnTo };
}
export function disconnect() { try { fs.unlinkSync(TOKEN_FILE); } catch {} _access = null; _cache = {}; return { ok: true }; }

/* ---------------- access token (locked refresh, rotation saved) ---------------- */
let _access = null;
async function withLock(fn) {
  const t0 = Date.now();
  for (;;) {
    try { fs.mkdirSync(LOCK_DIR); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - fs.statSync(LOCK_DIR).mtimeMs > 30000) fs.rmSync(LOCK_DIR, { recursive: true, force: true }); } catch {}
      if (Date.now() - t0 > 20000) throw new SpotifyError("lock_timeout", "spotify token lock timeout", 503);
      await sleep(150);
    }
  }
  try { return await fn(); } finally { try { fs.rmdirSync(LOCK_DIR); } catch {} }
}
export async function accessToken(force) {
  if (!force && _access && _access.exp - Date.now() > 90000) return _access.token;
  const cid = clientId();
  if (!cid) throw new SpotifyError("need_app", "Spotify app not set up on the box yet.", 409);
  return withLock(async () => {
    if (!force && _access && _access.exp - Date.now() > 90000) return _access.token;
    const rec = tokenRec();
    if (!rec || !rec.refresh_token || rec.clientId !== cid) throw new SpotifyError("need_auth", "Spotify not connected yet.", 409);
    const r = await fetch(`${ACCOUNTS}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rec.refresh_token, client_id: cid }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
      if (j.error === "invalid_grant") { disconnect(); throw new SpotifyError("need_auth", "Spotify login expired or was revoked. Connect again.", 409); }
      throw new SpotifyError("token_failed", `Spotify token refresh failed (${j.error_description || j.error || r.status}).`, 502);
    }
    if (j.refresh_token && j.refresh_token !== rec.refresh_token) writeJson600(TOKEN_FILE, { ...rec, refresh_token: j.refresh_token, rotatedAt: new Date().toISOString() });
    _access = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    return _access.token;
  });
}

/* ---------------- Web API ---------------- */
async function rawApi(method, p, body, token) {
  const r = await fetch(API + p, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204 || r.status === 202) return null;
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) {
    const msg = (j && j.error && (j.error.message || j.error)) || txt || String(r.status);
    const reason = (j && j.error && j.error.reason) || (j && j.reason) || "";
    const e = new SpotifyError("api_" + r.status, String(msg), r.status, { reason, retryAfter: Number(r.headers.get("retry-after")) || 0 });
    throw e;
  }
  return j;
}
export async function api(method, p, body) {
  let tok = await accessToken();
  try { return await rawApi(method, p, body, tok); } catch (e) {
    if (e.status === 401) { tok = await accessToken(true); return rawApi(method, p, body, tok); }
    if (e.status === 429 && e.retryAfter && e.retryAfter <= 3 && method !== "GET") { await sleep(e.retryAfter * 1000); return rawApi(method, p, body, tok); }
    throw friendly(e);
  }
}
function friendly(e) {
  if (!(e instanceof SpotifyError)) return e;
  const m = String(e.message || "");
  if (e.status === 403 && /premium/i.test(m + e.reason)) { e.code = "premium_required"; e.message = "Spotify Premium is needed to control playback."; }
  else if (e.status === 403 && /(user may not be registered|not registered|developer dashboard)/i.test(m)) { e.code = "not_allowlisted"; e.message = "Spotify says this account isn't on the app's user list (dashboard → User Management)."; }
  else if (e.status === 404 && /(no active device|NO_ACTIVE_DEVICE|device not found)/i.test(m + e.reason)) { e.code = "no_device"; e.message = "No Spotify speaker is awake. Open Spotify on a phone, speaker or computer."; }
  else if (e.status === 429) { e.code = "rate_limited"; e.message = "Spotify asked us to slow down for a moment."; }
  return e;
}

/* small per-key cache + in-flight dedupe so several screens polling at once cost one Spotify call */
let _cache = {};
const _gen = {}; /* bumped by bust(): a read that started before a command can't repopulate the cache with pre-command state */
async function cached(key, ttlMs, fn) {
  const c = _cache[key];
  if (c && c.val !== undefined && Date.now() - c.at < ttlMs) return c.val;
  if (c && c.p) return c.p;
  const g = _gen[key] || 0;
  const p = fn().then((val) => { if ((_gen[key] || 0) === g) _cache[key] = { val, at: Date.now() }; else if (_cache[key] && _cache[key].p === p) delete _cache[key]; return val; },
    (e) => { if (_cache[key] && _cache[key].p === p) delete _cache[key]; throw e; });
  _cache[key] = { ...(c || {}), p };
  return p;
}
function bust(...keys) { for (const k of keys) { delete _cache[k]; _gen[k] = (_gen[k] || 0) + 1; } }

function bestImage(imgs, want) {
  if (!Array.isArray(imgs) || !imgs.length) return "";
  const s = imgs.slice().sort((a, b) => (a.width || 0) - (b.width || 0));
  return (s.find((i) => (i.width || 0) >= want) || s[s.length - 1]).url || "";
}
function normItem(it) {
  if (!it) return null;
  if (it.type === "episode") {
    return { kind: "episode", id: it.id, uri: it.uri, name: it.name, artists: it.show ? it.show.name : "", showId: it.show ? it.show.id || "" : "", album: it.show ? it.show.publisher || "" : "",
      art: bestImage(it.images || (it.show && it.show.images), 600), artSmall: bestImage(it.images || (it.show && it.show.images), 120), durationMs: it.duration_ms || 0, url: it.external_urls && it.external_urls.spotify };
  }
  return { kind: "track", id: it.id, uri: it.uri, name: it.name, artists: (it.artists || []).map((a) => a.name).join(", "),
    album: it.album ? it.album.name : "", albumUri: it.album ? it.album.uri : "", albumId: it.album ? it.album.id || "" : "",
    artistList: (it.artists || []).map((a) => ({ id: a.id, name: a.name })), art: bestImage(it.album && it.album.images, 600), artSmall: bestImage(it.album && it.album.images, 120),
    durationMs: it.duration_ms || 0, explicit: !!it.explicit, url: it.external_urls && it.external_urls.spotify };
}
function normDevice(d) {
  if (!d) return null;
  return { id: d.id, name: d.name, type: d.type, active: !!d.is_active, restricted: !!d.is_restricted, volume: d.volume_percent == null ? null : d.volume_percent, supportsVolume: d.supports_volume !== false };
}
let _lastDevice = null; /* last device we saw playing — used to wake playback when nothing is active */
let _lastItem = null;

export async function readPlayer() {
  return cached("player", 1200, async () => {
    const j = await api("GET", "/me/player?additional_types=track,episode");
    if (!j) return { active: false, isPlaying: false, item: _lastItem, device: null, lastDevice: _lastDevice };
    const item = normItem(j.item);
    const device = normDevice(j.device);
    if (device && device.id) _lastDevice = { id: device.id, name: device.name, type: device.type };
    if (item) _lastItem = item;
    return {
      active: true,
      isPlaying: !!j.is_playing,
      progressMs: j.progress_ms || 0,
      at: Date.now(),
      item,
      device,
      shuffle: !!j.shuffle_state,
      repeat: j.repeat_state || "off",
      context: j.context ? { type: j.context.type, uri: j.context.uri } : null,
      type: j.currently_playing_type || (item && item.kind) || "unknown",
      disallows: (j.actions && j.actions.disallows) || {},
    };
  });
}
export async function devices() {
  return cached("devices", 4000, async () => {
    const j = await api("GET", "/me/player/devices");
    const list = ((j && j.devices) || []).map(normDevice);
    try { rememberRooms(list); } catch {}
    return list;
  });
}

/* SPOTIFY2 · HOME AUDIO. The house's speakers reach Spotify as Spotify Connect devices (Google/Nest
 * cast speakers + cast groups, phones, TVs). Spotify only lists a speaker while it's awake, so the box
 * remembers every speaker it has seen (name/type only) to keep the room list stable on the board. */
export const GROUP_RE = /\b(group|everywhere|whole[\s-]?(home|house)|all\s+(rooms|speakers)|house|downstairs|upstairs)\b/i;
const ROOM_TYPES = new Set(["Speaker", "CastAudio", "AVR", "TV", "CastVideo", "STB", "AudioDongle"]);
function rememberRooms(list) {
  const prev = readJson(ROOMS_FILE) || { rooms: {} };
  const now = new Date().toISOString();
  let changed = false;
  for (const d of list) {
    if (!d || !d.id || d.restricted) continue;
    const r = prev.rooms[d.id];
    if (!r || r.name !== d.name || r.type !== d.type || Date.now() - Date.parse(r.lastSeen || 0) > 3600e3) { prev.rooms[d.id] = { name: d.name, type: d.type, lastSeen: now }; changed = true; }
  }
  if (changed) writeJson600(ROOMS_FILE, prev);
}
export function rooms(awake) {
  const known = (readJson(ROOMS_FILE) || { rooms: {} }).rooms;
  const out = new Map();
  for (const d of awake || []) out.set(d.id, { ...d, awake: true });
  for (const [id, r] of Object.entries(known)) {
    if (out.has(id) || Date.now() - Date.parse(r.lastSeen || 0) > 45 * 864e5) continue;
    out.set(id, { id, name: r.name, type: r.type, active: false, awake: false, volume: null, supportsVolume: true });
  }
  /* one entry per name (a speaker that re-registers gets a new id) — prefer the awake one */
  const byName = new Map();
  for (const r of out.values()) { const k = r.name.toLowerCase(); const o = byName.get(k); if (!o || (!o.awake && r.awake) || r.active) byName.set(k, r); }
  return [...byName.values()].map((r) => ({ ...r, group: GROUP_RE.test(r.name), room: ROOM_TYPES.has(r.type) || GROUP_RE.test(r.name) }))
    .sort((a, b) => (b.active - a.active) || (b.group - a.group) || (b.room - a.room) || (b.awake - a.awake) || a.name.localeCompare(b.name));
}
export async function recent() {
  return cached("recent", 60000, async () => {
    const j = await api("GET", "/me/player/recently-played?limit=20");
    const seen = new Set(), out = [];
    for (const r of (j && j.items) || []) {
      const it = normItem(r.track); if (!it || seen.has(it.uri)) continue; seen.add(it.uri);
      out.push({ ...it, playedAt: r.played_at, context: r.context ? { type: r.context.type, uri: r.context.uri } : null });
    }
    return out.slice(0, 12);
  });
}
export async function playlists() {
  return cached("playlists", 5 * 60000, async () => {
    const j = await api("GET", "/me/playlists?limit=30");
    return ((j && j.items) || []).filter(Boolean).map((p) => ({
      id: p.id, uri: p.uri, name: p.name, owner: p.owner ? p.owner.display_name || p.owner.id : "",
      art: bestImage(p.images, 300), count: (p.items && p.items.total) ?? (p.tracks && p.tracks.total) ?? null,
    }));
  });
}
export async function me() {
  return cached("me", 30 * 60000, async () => { const j = await api("GET", "/me"); return { id: j.id, name: j.display_name || j.id }; });
}

export function status() {
  const t = tokenRec();
  return { clientId: !!clientId(), connected: connected(), user: connected() && t ? t.user || null : null, redirectUri: REDIRECT_URI, scopes: SCOPES, missingScopes: connected() ? missingScopes() : [] };
}

/** Full snapshot for the board. Never throws for setup states — returns them as data. */
export async function snapshot(opts = {}) {
  const st = status();
  if (!st.clientId) return { ok: true, state: "need_app", setup: st };
  if (!st.connected) return { ok: true, state: "need_auth", setup: st };
  try {
    const player = await readPlayer();
    const out = { ok: true, state: player.active ? (player.isPlaying ? "playing" : "paused") : "idle", setup: st, player: { ...player } };
    if (player.item && player.item.uri && !st.missingScopes.includes("user-library-read")) {
      try { const sv = await savedMap([player.item.uri]); out.player.item = { ...player.item, saved: !!sv[player.item.uri] }; } catch {}
    }
    if (opts.devices || !player.active) { try { out.devices = await devices(); out.rooms = rooms(out.devices); } catch (e) { out.devicesError = e.code || String(e.message); } }
    if (!player.active && !player.item) { try { const r = await recent(); if (r[0]) { out.player.item = r[0]; out.player.fromRecent = true; } } catch {} }
    return out;
  } catch (e) {
    if (e.code === "need_auth" || e.code === "need_app") return { ok: true, state: e.code, setup: status() };
    return { ok: false, state: "error", setup: st, error: e.code || "error", message: String(e.message || e) };
  }
}


/* ---------------- SPOTIFY2 · library / search / detail pages ---------------- */
function normAlbum(a) {
  if (!a) return null;
  return { kind: "album", id: a.id, uri: a.uri, name: a.name, sub: (a.artists || []).map((x) => x.name).join(", "),
    art: bestImage(a.images, 300), year: String(a.release_date || "").slice(0, 4), albumType: a.album_type || "", total: a.total_tracks || null,
    artists: (a.artists || []).map((x) => ({ id: x.id, uri: x.uri, name: x.name })) };
}
function normArtist(a) { return a && { kind: "artist", id: a.id, uri: a.uri, name: a.name, sub: (a.genres || []).slice(0, 2).join(" · ") || "Artist", art: bestImage(a.images, 300) }; }
function normPlaylist(p) {
  return p && { kind: "playlist", id: p.id, uri: p.uri, name: p.name, sub: p.owner ? "by " + (p.owner.display_name || p.owner.id) : "Playlist",
    art: bestImage(p.images, 300), total: (p.items && p.items.total) ?? (p.tracks && p.tracks.total) ?? null, ownerId: p.owner ? p.owner.id : "" };
}
function normShow(s) { return s && { kind: "show", id: s.id, uri: s.uri, name: s.name, sub: s.publisher || "Podcast", art: bestImage(s.images, 300) }; }
function normEpisode(e, show) {
  return e && { kind: "episode", id: e.id, uri: e.uri, name: e.name, sub: (show && show.name) || (e.show && e.show.name) || String(e.release_date || ""),
    art: bestImage(e.images || (e.show && e.show.images) || (show && show.images), 300), durationMs: e.duration_ms || 0, date: e.release_date || "" };
}
function normTrackRow(t) {
  const n = normItem(t); if (!n) return null;
  return { ...n, sub: n.artists, artistsList: (t.artists || []).map((x) => ({ id: x.id, uri: x.uri, name: x.name })), albumId: t.album ? t.album.id : "" };
}
const ID_RE = /^[A-Za-z0-9]{2,40}$/;
function needId(id) { id = String(id || ""); if (!ID_RE.test(id)) throw new SpotifyError("bad_request", "bad id", 400); return id; }
const URI_RE = /^spotify:(track|episode|album|artist|playlist|show|user:[A-Za-z0-9._-]+:collection)(:[A-Za-z0-9]{2,40})?$/;

/** { uri: true|false } for up to 40 uris (one call per 40 — /me/library/contains) */
export async function savedMap(uris) {
  uris = (uris || []).filter((u) => URI_RE.test(u)).slice(0, 40);
  if (!uris.length) return {};
  const key = "saved:" + uris.join(",");
  return cached(key, 5 * 60000, async () => {
    const j = await api("GET", "/me/library/contains" + q({ uris: uris.join(",") }));
    const out = {}; uris.forEach((u, i) => { out[u] = !!(Array.isArray(j) && j[i]); });
    _savedKeys.add(key);
    return out;
  });
}
const _savedKeys = new Set();
function bustSaved() { for (const k of _savedKeys) bust(k); _savedKeys.clear(); bust("lib:liked"); }

async function selfSaved(uri) {
  if (missingScopes().includes("user-library-read")) return null;
  try { return !!(await savedMap([uri]))[uri]; } catch { return null; }
}
async function withSaved(rows) {
  const uris = rows.filter((r) => r && (r.kind === "track" || r.kind === "episode")).map((r) => r.uri);
  if (!uris.length || missingScopes().includes("user-library-read")) return rows;
  try { const m = await savedMap(uris); return rows.map((r) => (r && m[r.uri] != null ? { ...r, saved: m[r.uri] } : r)); } catch { return rows; }
}

export async function browse(kind, arg, opts = {}) {
  const off = Math.max(0, Math.min(2000, Math.round(Number(opts.offset) || 0)));
  switch (kind) {
    case "search": {
      const text = String(arg || "").trim().slice(0, 120);
      if (!text) return { kind, items: {} };
      const types = String(opts.types || "track,artist,album,playlist,show,episode").split(",").filter((t) => ["track", "artist", "album", "playlist", "show", "episode", "audiobook"].includes(t));
      return cached("search:" + types.join(",") + ":" + text.toLowerCase(), 60000, async () => {
        const j = await api("GET", "/search" + q({ q: text, type: types.join(","), limit: 10 }));
        const pick = (k, f) => ((j && j[k] && j[k].items) || []).filter(Boolean).map(f).filter(Boolean);
        return { kind, q: text, items: {
          tracks: await withSaved(pick("tracks", normTrackRow)), artists: pick("artists", normArtist), albums: pick("albums", normAlbum),
          playlists: pick("playlists", normPlaylist), shows: pick("shows", normShow), episodes: pick("episodes", (e) => normEpisode(e)),
        } };
      });
    }
    case "liked": return cached("lib:liked:" + off, 60000, async () => {
      const j = await api("GET", "/me/tracks" + q({ limit: 50, offset: off }));
      const me_ = await me().catch(() => null);
      return { kind, name: "Liked Songs", total: (j && j.total) || 0, offset: off, contextUri: me_ ? `spotify:user:${me_.id}:collection` : "",
        items: ((j && j.items) || []).map((x) => x && normTrackRow(x.track)).filter(Boolean).map((r) => ({ ...r, saved: true })) };
    });
    case "playlists": return cached("lib:playlists:" + off, 3 * 60000, async () => {
      const j = await api("GET", "/me/playlists" + q({ limit: 50, offset: off }));
      return { kind, total: (j && j.total) || 0, items: ((j && j.items) || []).filter(Boolean).map(normPlaylist) };
    });
    case "albums": return cached("lib:albums:" + off, 3 * 60000, async () => {
      const j = await api("GET", "/me/albums" + q({ limit: 50, offset: off }));
      return { kind, total: (j && j.total) || 0, items: ((j && j.items) || []).map((x) => x && normAlbum(x.album)).filter(Boolean) };
    });
    case "artists": return cached("lib:artists", 3 * 60000, async () => {
      const j = await api("GET", "/me/following" + q({ type: "artist", limit: 50 }));
      return { kind, items: ((j && j.artists && j.artists.items) || []).filter(Boolean).map(normArtist) };
    });
    case "shows": return cached("lib:shows:" + off, 3 * 60000, async () => {
      const j = await api("GET", "/me/shows" + q({ limit: 50, offset: off }));
      return { kind, total: (j && j.total) || 0, items: ((j && j.items) || []).map((x) => x && normShow(x.show)).filter(Boolean) };
    });
    case "recent": return { kind, items: await recent() };
    case "queue": return cached("queue", 2500, async () => {
      const j = await api("GET", "/me/player/queue");
      const n = (x) => (x && x.type === "episode" ? normEpisode(x) : normTrackRow(x));
      return { kind, current: j && j.currently_playing ? n(j.currently_playing) : null, items: ((j && j.queue) || []).slice(0, 30).map(n).filter(Boolean) };
    });
    case "album": { const id = needId(arg); return cached("album:" + id, 10 * 60000, async () => {
      const a = await api("GET", `/albums/${id}`);
      const base = normAlbum(a);
      const rows = ((a.tracks && a.tracks.items) || []).filter(Boolean).map((t) => ({ ...normTrackRow({ ...t, album: a }), n: t.track_number }));
      return { kind, ...base, label: a.label || "", saved: await selfSaved(base.uri), items: await withSaved(rows) };
    }); }
    case "artist": { const id = needId(arg); return cached("artist:" + id, 10 * 60000, async () => {
      const [a, al] = await Promise.all([api("GET", `/artists/${id}`), api("GET", `/artists/${id}/albums` + q({ include_groups: "album,single", limit: 30 }))]);
      /* top-tracks endpoint is gone for new dev apps → popular-ish tracks via search scoped to the artist */
      let tracks = [];
      try { const s = await api("GET", "/search" + q({ q: `artist:"${a.name}"`, type: "track", limit: 10 })); tracks = ((s && s.tracks && s.tracks.items) || []).filter((t) => (t.artists || []).some((x) => x.id === id)).map(normTrackRow); } catch {}
      return { kind, ...normArtist(a), saved: await selfSaved(a.uri), items: await withSaved(tracks), albums: ((al && al.items) || []).filter(Boolean).map(normAlbum) };
    }); }
    case "playlist": { const id = needId(arg); return cached("playlist:" + id, 2 * 60000, async () => {
      const p = await api("GET", `/playlists/${id}` + q({ fields: "id,uri,name,description,images,owner(id,display_name),items(total),tracks(total)" }));
      let rows = [], limited = false;
      try {
        const it = await api("GET", `/playlists/${id}/items` + q({ limit: 50, additional_types: "track,episode" }));
        rows = ((it && it.items) || []).map((x) => x && (x.item || x.track)).filter(Boolean).map((t) => (t.type === "episode" ? normEpisode(t) : normTrackRow(t))).filter(Boolean);
      } catch (e) { if (e.status === 403 || e.status === 404) limited = true; else throw e; }
      return { kind, ...normPlaylist(p), saved: await selfSaved(p.uri), description: String(p.description || "").replace(/<[^>]+>/g, ""), limited, items: await withSaved(rows) };
    }); }
    case "show": { const id = needId(arg); return cached("show:" + id, 10 * 60000, async () => {
      const [s, ep] = await Promise.all([api("GET", `/shows/${id}`), api("GET", `/shows/${id}/episodes` + q({ limit: 30 }))]);
      return { kind, ...normShow(s), saved: await selfSaved(s.uri), items: ((ep && ep.items) || []).filter(Boolean).map((e) => normEpisode(e, s)) };
    }); }
    default: throw new SpotifyError("bad_request", "kind must be search|liked|playlists|albums|artists|shows|recent|queue|album|artist|playlist|show", 400);
  }
}

/* ---------------- control ---------------- */
async function wakeDevice(preferId) {
  const list = await devices().catch(() => []);
  const pick = (preferId && list.find((d) => d.id === preferId)) || list.find((d) => d.active) ||
    (_lastDevice && list.find((d) => d.id === _lastDevice.id)) || list.find((d) => !d.restricted);
  return pick || null;
}
function q(params) { const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString(); return s ? "?" + s : ""; }

export async function control(body) {
  body = body || {};
  const a = String(body.action || "");
  const dev = body.deviceId ? String(body.deviceId) : "";
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v))));
  const run = async () => {
    switch (a) {
      case "play": {
        const payload = {};
        if (body.contextUri) payload.context_uri = String(body.contextUri);
        if (Array.isArray(body.uris)) payload.uris = body.uris.slice(0, 50).map(String);
        if (body.offsetUri) payload.offset = { uri: String(body.offsetUri) };
        else if (Number.isFinite(body.offsetPos)) payload.offset = { position: clampInt(body.offsetPos, 0, 9999) };
        if (Number.isFinite(body.positionMs)) payload.position_ms = clampInt(body.positionMs, 0, 24 * 3600 * 1000);
        const hasPayload = Object.keys(payload).length > 0;
        try { return await api("PUT", "/me/player/play" + q({ device_id: dev }), hasPayload ? payload : undefined); }
        catch (e) {
          if (e.code !== "no_device" && !(e.status === 404)) throw e;
          const d = await wakeDevice(dev);
          if (!d) throw new SpotifyError("no_device", "No Spotify speaker is awake. Open Spotify on a phone, speaker or computer.", 404);
          if (!hasPayload) { await api("PUT", "/me/player", { device_ids: [d.id], play: true }); return null; }
          return api("PUT", "/me/player/play" + q({ device_id: d.id }), payload);
        }
      }
      case "pause": return api("PUT", "/me/player/pause" + q({ device_id: dev }));
      case "next": return api("POST", "/me/player/next" + q({ device_id: dev }));
      case "previous": return api("POST", "/me/player/previous" + q({ device_id: dev }));
      case "seek": return api("PUT", "/me/player/seek" + q({ position_ms: clampInt(body.positionMs, 0, 24 * 3600 * 1000), device_id: dev }));
      case "volume": {
        try { return await api("PUT", "/me/player/volume" + q({ volume_percent: clampInt(body.volume, 0, 100), device_id: dev })); }
        catch (e) { if (dev && e.status === 404) throw new SpotifyError("room_not_playing", "Spotify sets volume on the speaker that's playing. Move the music there first.", 409); throw e; }
      }
      case "shuffle": return api("PUT", "/me/player/shuffle" + q({ state: body.state ? "true" : "false", device_id: dev }));
      case "repeat": {
        const s = ["off", "context", "track"].includes(body.state) ? body.state : "off";
        return api("PUT", "/me/player/repeat" + q({ state: s, device_id: dev }));
      }
      case "transfer": {
        if (!dev) throw new SpotifyError("bad_request", "deviceId required", 400);
        try { return await api("PUT", "/me/player", { device_ids: [dev], play: body.play !== false }); }
        catch (e) {
          if (e.status !== 404) throw e;
          const r = rooms([]).find((x) => x.id === dev);
          throw new SpotifyError("room_asleep", `${r ? r.name : "That speaker"} is asleep for Spotify. Say “Hey Google, play Spotify on ${r ? r.name : "it"}” once, or open Spotify and pick it — then it's here.`, 404);
        }
      }
      case "queue": {
        const uri = String(body.uri || "");
        if (!/^spotify:(track|episode):[A-Za-z0-9]{2,40}$/.test(uri)) throw new SpotifyError("bad_request", "uri must be a track/episode uri", 400);
        return api("POST", "/me/player/queue" + q({ uri, device_id: dev }));
      }
      case "like": case "unlike": {
        const uris = (Array.isArray(body.uris) ? body.uris : [body.uri]).map(String).filter((u) => URI_RE.test(u)).slice(0, 40);
        if (!uris.length) throw new SpotifyError("bad_request", "uri required", 400);
        return api(a === "like" ? "PUT" : "DELETE", "/me/library" + q({ uris: uris.join(",") }));
      }
      default: throw new SpotifyError("bad_request", "action must be play|pause|next|previous|seek|volume|shuffle|repeat|transfer|queue|like|unlike", 400);
    }
  };
  await run();
  if (a === "like" || a === "unlike") { bustSaved(); for (const k of Object.keys(_cache)) if (/^(album|artist|playlist|search|lib:albums|lib:artists|lib:shows|lib:playlists):?/.test(k)) bust(k); }
  bust("player", "devices", "queue");
  if (a === "play" || a === "next" || a === "previous") bust("recent");
  /* Spotify applies commands a beat later; read back so the reply is the real state */
  await sleep(a === "volume" || a === "seek" || a === "like" || a === "unlike" || a === "queue" ? 250 : 450);
  let snap = await snapshot({ devices: a === "transfer" || !!body.withRooms || (a === "volume" && !!dev) });
  const want = a === "pause" ? false : a === "play" || a === "transfer" ? true : null;
  if (want != null && snap.player && snap.player.isPlaying !== want) { await sleep(700); bust("player"); snap = await snapshot({ devices: a === "transfer" || !!body.withRooms }); }
  return snap;
}

/* ---------------- CLI ---------------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const out = (o) => console.log(JSON.stringify(o, null, 2));
  try {
    if (cmd === "status" || !cmd) out(status());
    else if (cmd === "set-client") out(setClientId(rest[0]));
    else if (cmd === "auth-url") out(authStart(rest[0] || "sheet-spotify.html"));
    else if (cmd === "state") out(await snapshot({ devices: true }));
    else if (cmd === "devices") out(await devices());
    else if (cmd === "rooms") out(rooms(await devices().catch(() => [])));
    else if (cmd === "library") out({ recent: await recent(), playlists: await playlists() });
    else if (cmd === "browse") out(await browse(rest[0], rest.slice(1).join(" ")));
    else if (cmd === "disconnect") out(disconnect());
    else if (cmd === "do") {
      const [action, v] = rest; const b = { action };
      if (action === "volume") b.volume = Number(v);
      if (action === "shuffle") b.state = v === "on" || v === "true";
      if (action === "repeat") b.state = v || "off";
      if (action === "seek") b.positionMs = Number(v);
      if (action === "transfer") b.deviceId = v;
      if (action === "queue" || action === "like" || action === "unlike") b.uri = v;
      out(await control(b));
    } else { console.error("usage: status | set-client ID | auth-url | state | devices | library | do ACTION [v] | disconnect"); process.exit(2); }
  } catch (e) { console.error(JSON.stringify({ ok: false, error: e.code || "error", message: String(e.message || e) })); process.exit(1); }
}
