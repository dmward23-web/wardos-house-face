#!/usr/bin/env node
/**
 * SPOTIFY1 QA · tiny local stand-in for accounts.spotify.com + api.spotify.com/v1 (box-only test rig).
 * Lets the whole board → box proxy → "Spotify" path be exercised before the real Spotify app exists,
 * and records every Web API call so the gate can check the exact method/path/body the box sends.
 *
 *   node scripts/qa/spotify-mock.mjs --port 8799 [--art-dir DIR] [--redirect-to URL]
 *   proxy env: SPOTIFY_ACCOUNTS_BASE=http://127.0.0.1:8799 SPOTIFY_API_BASE=http://127.0.0.1:8799/v1
 *   GET /_log → recorded calls · POST /_reset
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(opt("--port", 8799));
const ART = opt("--art-dir", "");
const REDIRECT_TO = opt("--redirect-to", "");
const ORIGIN = `http://127.0.0.1:${PORT}`;

const art = (n) => ART ? `${ORIGIN}/art/${n}.png` : "";
const img = (n) => [{ url: art(n), width: 640, height: 640 }, { url: art(n), width: 300, height: 300 }, { url: art(n), width: 64, height: 64 }];
const TRACKS = [
  { id: "t1", name: "Lantern Season", artists: [{ name: "The Quiet Ridge" }], album: { name: "Fields at Dusk", uri: "spotify:album:a1", images: img(1) }, duration_ms: 214000 },
  { id: "t2", name: "Paper Boats", artists: [{ name: "Marlow & Finch" }], album: { name: "Harbor Lights", uri: "spotify:album:a2", images: img(2) }, duration_ms: 187000 },
  { id: "t3", name: "Saturday Porch", artists: [{ name: "Juniper Ave" }], album: { name: "Front Steps", uri: "spotify:album:a3", images: img(3) }, duration_ms: 243000 },
  { id: "t4", name: "Glow in the Pines", artists: [{ name: "Northbound Kids" }], album: { name: "Campfire Tapes", uri: "spotify:album:a4", images: img(4) }, duration_ms: 199000 },
].map((t) => ({ ...t, type: "track", uri: "spotify:track:" + t.id, explicit: false, external_urls: { spotify: "https://open.spotify.com/track/" + t.id } }));
const PLAYLISTS = [
  { id: "p1", name: "Family Dinner", art: 2, n: 48 }, { id: "p2", name: "Saturday Chores Mix", art: 3, n: 61 },
  { id: "p3", name: "Car Ride Singalongs", art: 4, n: 35 }, { id: "p4", name: "Wind Down", art: 1, n: 22 },
].map((p) => ({ id: p.id, uri: "spotify:playlist:" + p.id, name: p.name, owner: { display_name: "Dan Ward", id: "dmward" }, images: img(p.art), items: { total: p.n } }));

/* SPOTIFY2 · catalog for search / library / detail pages (Feb-2026 shapes: playlist items.items[].item) */
const ARTISTS = [["ar1", "The Quiet Ridge", 1], ["ar2", "Marlow & Finch", 2], ["ar3", "Juniper Ave", 3], ["ar4", "Northbound Kids", 4]]
  .map(([id, name, a]) => ({ id, name, type: "artist", uri: "spotify:artist:" + id, images: img(a), genres: ["indie folk"] }));
TRACKS.forEach((t, i) => { t.artists = [{ id: ARTISTS[i].id, uri: ARTISTS[i].uri, name: ARTISTS[i].name }]; t.album = { ...t.album, id: "a" + (i + 1), artists: t.artists, release_date: "202" + i + "-05-01", album_type: "album", total_tracks: 1 }; t.track_number = 1; });
const ALBUMS = TRACKS.map((t) => ({ ...t.album, type: "album", tracks: { items: [t] } }));
const SHOWS = [{ id: "sh1", name: "Front Porch Radio", publisher: "Ward Family", images: img(3) }, { id: "sh2", name: "Kids Science Hour", publisher: "Little Lab", images: img(4) }]
  .map((x) => ({ ...x, type: "show", uri: "spotify:show:" + x.id }));
const EPISODES = [1, 2, 3].map((n) => ({ id: "ep" + n, type: "episode", uri: "spotify:episode:ep" + n, name: "Episode " + n + " · Lanterns", duration_ms: 1800000, release_date: "2026-09-2" + n, images: img(3), show: SHOWS[0] }));
let SAVED = new Set(["spotify:track:t2", "spotify:track:t4"]);
let QUEUE = [];

let S, LOG, codes, tokens;
function reset() {
  S = {
    devices: [
      { id: "dev-lr", name: "Living Room", type: "Speaker", is_active: true, is_restricted: false, volume_percent: 42, supports_volume: true },
      { id: "dev-iph", name: "Dan's iPhone", type: "Smartphone", is_active: false, is_restricted: false, volume_percent: 100, supports_volume: true },
      { id: "dev-kit", name: "Kitchen Speaker", type: "Speaker", is_active: false, is_restricted: false, volume_percent: 30, supports_volume: true },
      { id: "dev-all", name: "Everywhere", type: "CastAudio", is_active: false, is_restricted: false, volume_percent: 35, supports_volume: true },
      { id: "dev-tv", name: "Family Room TV", type: "TV", is_active: false, is_restricted: false, volume_percent: 20, supports_volume: true },
    ],
    idx: 0, playing: true, pos: 61000, at: Date.now(), shuffle: false, repeat: "off", active: true,
    context: { type: "playlist", uri: "spotify:playlist:p1" },
  };
  LOG = []; codes = codes || {}; tokens = tokens || {}; SAVED = new Set(["spotify:track:t2", "spotify:track:t4"]); QUEUE = [];
}
reset();
const pos = () => Math.min(TRACKS[S.idx].duration_ms, S.pos + (S.playing ? Date.now() - S.at : 0));
const setPos = (p) => { S.pos = p; S.at = Date.now(); };
const activeDev = () => S.devices.find((d) => d.is_active);

function send(res, code, obj, hdr) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...(hdr || {}) });
  res.end(obj == null ? "" : JSON.stringify(obj));
}
const body = (req) => new Promise((r) => { const c = []; req.on("data", (x) => c.push(x)); req.on("end", () => r(Buffer.concat(c).toString())); });
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

http.createServer(async (req, res) => {
  const u = new URL(req.url, ORIGIN);
  const p = u.pathname;
  if (p === "/_log") return send(res, 200, LOG);
  if (p === "/_reset") { reset(); return send(res, 200, { ok: true }); }
  if (p === "/_idle") { S.active = false; S.devices.forEach((d) => (d.is_active = false)); return send(res, 200, { ok: true }); }
  if (p.startsWith("/art/") && ART) {
    const f = path.join(ART, path.basename(p));
    if (fs.existsSync(f)) { res.writeHead(200, { "Content-Type": "image/png", "Access-Control-Allow-Origin": "*" }); return res.end(fs.readFileSync(f)); }
    return send(res, 404, {});
  }
  if (p === "/authorize") {
    const code = "code-" + crypto.randomBytes(6).toString("hex");
    codes[code] = { challenge: u.searchParams.get("code_challenge"), redirect: u.searchParams.get("redirect_uri"), client: u.searchParams.get("client_id"), scope: u.searchParams.get("scope") };
    LOG.push({ m: "GET", p: "/authorize", q: Object.fromEntries(u.searchParams) });
    const to = new URL(REDIRECT_TO || u.searchParams.get("redirect_uri"));
    to.searchParams.set("code", code); to.searchParams.set("state", u.searchParams.get("state"));
    res.writeHead(302, { Location: to.toString() }); return res.end();
  }
  if (p === "/api/token" && req.method === "POST") {
    const f = new URLSearchParams(await body(req));
    LOG.push({ m: "POST", p: "/api/token", grant: f.get("grant_type") });
    if (f.get("grant_type") === "authorization_code") {
      const c = codes[f.get("code")]; delete codes[f.get("code")];
      if (!c) return send(res, 400, { error: "invalid_grant", error_description: "Invalid authorization code" });
      const ok = b64url(crypto.createHash("sha256").update(f.get("code_verifier") || "").digest()) === c.challenge;
      if (!ok) return send(res, 400, { error: "invalid_grant", error_description: "code_verifier was incorrect" });
      if (f.get("redirect_uri") !== c.redirect || f.get("client_id") !== c.client) return send(res, 400, { error: "invalid_grant", error_description: "redirect/client mismatch" });
      const at = "at-" + crypto.randomBytes(8).toString("hex"), rt = "rt-" + crypto.randomBytes(8).toString("hex");
      tokens[at] = 1; tokens["r:" + rt] = 1;
      return send(res, 200, { access_token: at, token_type: "Bearer", expires_in: 3600, refresh_token: rt, scope: c.scope });
    }
    if (f.get("grant_type") === "refresh_token") {
      if (!tokens["r:" + f.get("refresh_token")]) return send(res, 400, { error: "invalid_grant", error_description: "Refresh token revoked" });
      const at = "at-" + crypto.randomBytes(8).toString("hex"), rt = "rt-" + crypto.randomBytes(8).toString("hex");
      tokens[at] = 1; tokens["r:" + rt] = 1;
      return send(res, 200, { access_token: at, token_type: "Bearer", expires_in: 3600, refresh_token: rt });
    }
    return send(res, 400, { error: "unsupported_grant_type" });
  }
  if (!p.startsWith("/v1/")) return send(res, 404, { error: { status: 404, message: "not found" } });
  const auth = (req.headers.authorization || "").replace(/^Bearer /, "");
  const raw = await body(req);
  let jb = null; try { jb = raw ? JSON.parse(raw) : null; } catch {}
  const api = p.slice(3);
  if (!(api === "/me/player" && req.method === "GET") && !(api === "/me/player/devices")) LOG.push({ m: req.method, p: api, q: Object.fromEntries(u.searchParams), body: jb });
  if (!tokens[auth]) return send(res, 401, { error: { status: 401, message: "The access token expired" } });
  const dev = u.searchParams.get("device_id");
  const noDev = () => send(res, 404, { error: { status: 404, message: "Player command failed: No active device found", reason: "NO_ACTIVE_DEVICE" } });
  const R = req.method + " " + api;
  switch (R) {
    case "GET /me": return send(res, 200, { id: "dmward", display_name: "Dan Ward", type: "user" });
    case "GET /me/player": {
      if (!S.active) return send(res, 204, null);
      const d = activeDev();
      return send(res, 200, { device: d, shuffle_state: S.shuffle, repeat_state: S.repeat, timestamp: Date.now(), context: S.context, progress_ms: pos(), item: TRACKS[S.idx], currently_playing_type: "track", actions: { disallows: S.playing ? {} : { pausing: true } }, is_playing: S.playing });
    }
    case "GET /me/player/devices": return send(res, 200, { devices: S.devices });
    case "PUT /me/player/play": {
      if (!S.active && !dev) return noDev();
      if (dev) S.devices.forEach((d) => (d.is_active = d.id === dev));
      S.active = true;
      if (jb && jb.context_uri) { S.context = { type: jb.context_uri.split(":")[1], uri: jb.context_uri }; S.idx = (S.idx + 1) % TRACKS.length; setPos(0); }
      if (jb && jb.uris) { const i = TRACKS.findIndex((t) => t.uri === jb.uris[0]); if (i >= 0) S.idx = i; S.context = null; setPos(0); }
      setPos(pos()); S.playing = true; return send(res, 204, null);
    }
    case "PUT /me/player/pause": if (!S.active) return noDev(); setPos(pos()); S.playing = false; return send(res, 204, null);
    case "POST /me/player/next": { if (!S.active) return noDev(); const qn = QUEUE.shift(); const qi = qn ? TRACKS.findIndex((t) => t.uri === qn) : -1; S.idx = qi >= 0 ? qi : (S.idx + 1) % TRACKS.length; setPos(0); return send(res, 204, null); }
    case "POST /me/player/previous": if (!S.active) return noDev(); if (pos() > 3000) setPos(0); else { S.idx = (S.idx + TRACKS.length - 1) % TRACKS.length; setPos(0); } return send(res, 204, null);
    case "PUT /me/player/seek": if (!S.active) return noDev(); setPos(Number(u.searchParams.get("position_ms")) || 0); return send(res, 204, null);
    case "PUT /me/player/volume": {
      if (!S.active) return noDev(); const d = activeDev();
      if (dev && dev !== d.id) return send(res, 404, { error: { status: 404, message: "Device not found" } }); /* real Spotify: only the playing device takes volume */
      d.volume_percent = Number(u.searchParams.get("volume_percent")); return send(res, 204, null);
    }
    case "PUT /me/player/shuffle": if (!S.active) return noDev(); S.shuffle = u.searchParams.get("state") === "true"; return send(res, 204, null);
    case "PUT /me/player/repeat": if (!S.active) return noDev(); S.repeat = u.searchParams.get("state"); return send(res, 204, null);
    case "PUT /me/player": {
      const id = jb && jb.device_ids && jb.device_ids[0];
      if (!S.devices.find((d) => d.id === id)) return send(res, 404, { error: { status: 404, message: "Device not found" } });
      S.devices.forEach((d) => (d.is_active = d.id === id)); S.active = true; setPos(pos()); if (jb.play) S.playing = true; return send(res, 204, null);
    }
    case "GET /me/player/recently-played":
      return send(res, 200, { items: [2, 3, 1, 0, 2].map((i, k) => ({ track: TRACKS[i], played_at: new Date(Date.now() - (k + 1) * 600000).toISOString(), context: { type: "playlist", uri: "spotify:playlist:p" + (k % 4 + 1) } })) });
    case "GET /me/playlists": return send(res, 200, { items: PLAYLISTS, total: PLAYLISTS.length });
    case "GET /me/tracks": return send(res, 200, { total: SAVED.size, items: TRACKS.filter((t) => SAVED.has(t.uri)).map((t) => ({ added_at: "2026-09-01T00:00:00Z", track: t })) });
    case "GET /me/albums": return send(res, 200, { total: 2, items: ALBUMS.slice(0, 2).map((a) => ({ album: a })) });
    case "GET /me/following": return send(res, 200, { artists: { items: ARTISTS, total: ARTISTS.length } });
    case "GET /me/shows": return send(res, 200, { total: SHOWS.length, items: SHOWS.map((x) => ({ show: x })) });
    case "GET /me/library/contains": return send(res, 200, String(u.searchParams.get("uris") || "").split(",").map((x) => SAVED.has(x)));
    case "PUT /me/library": String(u.searchParams.get("uris") || "").split(",").forEach((x) => SAVED.add(x)); return send(res, 200, null);
    case "DELETE /me/library": String(u.searchParams.get("uris") || "").split(",").forEach((x) => SAVED.delete(x)); return send(res, 200, null);
    case "GET /me/player/queue": return send(res, 200, { currently_playing: S.active ? TRACKS[S.idx] : null, queue: [...QUEUE.map((x) => TRACKS.find((t) => t.uri === x) || EPISODES.find((e) => e.uri === x)).filter(Boolean), ...[1, 2, 3].map((k) => TRACKS[(S.idx + k) % TRACKS.length])] });
    case "POST /me/player/queue": if (!S.active) return noDev(); QUEUE.push(u.searchParams.get("uri")); return send(res, 200, null);
    case "GET /search": {
      const t = String(u.searchParams.get("q") || "").toLowerCase().replace(/artist:"?([^"]+)"?/, "$1");
      const lim = Number(u.searchParams.get("limit") || 5);
      if (lim > 10) return send(res, 400, { error: { status: 400, message: "Invalid limit" } });
      const m = (x) => !t || JSON.stringify([x.name, x.artists && x.artists.map((a) => a.name)]).toLowerCase().includes(t.split(" ")[0]);
      const pg = (arr) => ({ items: arr.filter(m).slice(0, lim), total: arr.length });
      return send(res, 200, { tracks: pg(TRACKS), artists: pg(ARTISTS), albums: pg(ALBUMS), playlists: { items: [...PLAYLISTS.slice(0, 2), null] }, shows: pg(SHOWS), episodes: pg(EPISODES) });
    }
  }
  let mm;
  if (req.method === "GET" && (mm = api.match(/^\/albums\/(\w+)$/))) { const a = ALBUMS.find((x) => x.id === mm[1]); return a ? send(res, 200, a) : send(res, 404, { error: { status: 404, message: "no album" } }); }
  if (req.method === "GET" && (mm = api.match(/^\/artists\/(\w+)$/))) { const a = ARTISTS.find((x) => x.id === mm[1]); return a ? send(res, 200, a) : send(res, 404, { error: { status: 404, message: "no artist" } }); }
  if (req.method === "GET" && (mm = api.match(/^\/artists\/(\w+)\/albums$/))) { const i = ARTISTS.findIndex((x) => x.id === mm[1]); return send(res, 200, { items: [ALBUMS[i], ALBUMS[(i + 1) % 4]].filter(Boolean) }); }
  if (req.method === "GET" && (mm = api.match(/^\/playlists\/(\w+)$/))) { const pl = PLAYLISTS.find((x) => x.id === mm[1]); return pl ? send(res, 200, pl) : send(res, 404, { error: { status: 404, message: "no playlist" } }); }
  if (req.method === "GET" && (mm = api.match(/^\/playlists\/(\w+)\/items$/))) return send(res, 200, { total: 4, items: [0, 1, 2, 3].map((k) => ({ item: TRACKS[(k + mm[1].length) % 4] })) });
  if (req.method === "GET" && (mm = api.match(/^\/shows\/(\w+)$/))) { const x = SHOWS.find((y) => y.id === mm[1]); return x ? send(res, 200, x) : send(res, 404, {}); }
  if (req.method === "GET" && (mm = api.match(/^\/shows\/(\w+)\/episodes$/))) return send(res, 200, { items: EPISODES.map(({ show, ...e }) => e) });
  return send(res, 404, { error: { status: 404, message: "mock: unhandled " + R } });
}).listen(PORT, "127.0.0.1", () => console.log("spotify-mock on " + ORIGIN));
