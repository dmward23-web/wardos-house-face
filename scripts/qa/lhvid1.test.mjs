/* LHVID1 · the proxy serves the night-scene loop videos from a private folder outside git (node --test scripts/qa/lhvid1.test.mjs).
   Synthetic media only (a few fake bytes), temp HOME, loopback Google mock not needed (static path only). */
import { spawnListening } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROXY = path.join(ROOT, "scripts/nest-webrtc-proxy.mjs");
const KEY = "test-lhvid1-key-0123456789abcdef";
for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
/* LHVID1' teardown · every temp path this file makes is tracked and removed by exact path (after() and on exit), never a glob */
const MADE = [];
const tmp = (pfx) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), pfx)); MADE.push(d); return d; };
const cleanup = () => { for (const d of MADE.splice(0)) try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* gone */ } };
process.on("exit", cleanup);

function fakeHome() {
  const home = tmp("lhvid1-home-"), cfg = path.join(home, ".config/wardos");
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, "nest-refresh.token"), "fake-refresh\n");
  fs.writeFileSync(path.join(cfg, "nest-sdm.json"), '{"projectId":"p","clientId":"c","clientSecret":"s"}');
  fs.writeFileSync(path.join(cfg, "nest-device.token"), KEY + "\n", { mode: 0o600 });
  return home;
}
function media() {
  const d = tmp("lhvid1-media-"), out = tmp("lhvid1-outside-");
  fs.mkdirSync(path.join(d, "v52"));
  fs.writeFileSync(path.join(d, "loop-day-wall.mp4"), Buffer.from("0123456789ABCDEF"));
  fs.writeFileSync(path.join(d, "v52/loop-phone.mp4"), Buffer.from("v52-phone-bytes"));
  fs.writeFileSync(path.join(d, "notes.txt"), "not a video");
  fs.writeFileSync(path.join(d, "unlisted-clip.mp4"), "a plain name that is not on allow.json");
  fs.writeFileSync(path.join(out, "outside.mp4"), "outside");
  fs.symlinkSync(path.join(out, "outside.mp4"), path.join(d, "escape.mp4"));
  fs.symlinkSync(path.join(d, "loop-day-wall.mp4"), path.join(d, "loop-dusk-wall.mp4"));   /* LISTED name, but a symlink that stays inside: refused */
  return d;
}
const MEDIA = media();
let P;
test.before(async () => {
  const home = fakeHome();
  const env = { ...process.env, HOME: home }; delete env.NEST_PROXY_TOKEN; delete env.NEST_REFRESH_TOKEN;
  P = spawnListening("node", [PROXY, "--host", "127.0.0.1", "--port", "0", "--night-media", MEDIA], { env });
  if (!(await P.ready)) throw new Error("proxy did not start");
  assert.equal((await fetch(P.base + "/health")).status, 200);
});
test.after(async () => { P.child.kill(); await P.exited; cleanup(); });

test("allow-list: .mp4 under night/media only, plain names, no traversal", async () => {
  const { NIGHT_MP4, nightMediaPath } = await import(PROXY);
  for (const ok of ["night/media/loop-day-wall.mp4", "night/media/v52/loop-phone.mp4"]) assert.ok(NIGHT_MP4.test(ok), ok);
  assert.equal(nightMediaPath("night/media/unlisted-clip.mp4", MEDIA), null, "a plain name not on allow.json is refused");
  assert.equal(nightMediaPath("night/media/loop-dusk-wall.mp4", MEDIA), null, "a listed name that is a symlink is refused (lstat)");
  for (const bad of ["night/media/../x.mp4", "night/media/a/b.mp4", "night/media/x.mov", "night/media/x.mp4.txt", "night/x.mp4", "media/x.mp4", "night/media/.x.mp4", "night/media/v52/../../a.mp4", "night/media/%2e%2e.mp4"])
    assert.equal(nightMediaPath(bad, MEDIA), null, bad);
  assert.equal(nightMediaPath("night/media/escape.mp4", MEDIA), null, "symlink out of the folder is denied");
  assert.equal(nightMediaPath("night/media/missing.mp4", MEDIA), null);
  assert.ok(nightMediaPath("night/media/loop-day-wall.mp4", MEDIA));
});

test("serves a present video with byte ranges, no token needed (same as other static files)", async () => {
  let r = await fetch(P.base + "/night/media/loop-day-wall.mp4");
  assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "video/mp4"); assert.equal(r.headers.get("accept-ranges"), "bytes");
  assert.equal(await r.text(), "0123456789ABCDEF");
  r = await fetch(P.base + "/night/media/loop-day-wall.mp4", { headers: { Range: "bytes=4-7" } });
  assert.equal(r.status, 206); assert.equal(r.headers.get("content-range"), "bytes 4-7/16"); assert.equal(await r.text(), "4567");
  r = await fetch(P.base + "/night/media/loop-day-wall.mp4", { headers: { Range: "bytes=99-" } });
  assert.equal(r.status, 416); await r.text();
  r = await fetch(P.base + "/night/media/v52/loop-phone.mp4");
  assert.equal(r.status, 200); assert.equal(await r.text(), "v52-phone-bytes");
});

test("a missing video is a plain 404 (the page falls back to its still poster)", async () => {
  const r = await fetch(P.base + "/night/media/loop-dusk-phone.mp4");
  assert.equal(r.status, 404); assert.deepEqual(await r.json(), { error: "not found" });
});

function rawGet(p) {   // raw request line so the path is not normalised by the client
  return new Promise((res, rej) => {
    const s = net.connect(P.port, "127.0.0.1", () => s.write(`GET ${p} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`));
    let b = ""; s.on("data", (d) => (b += d)); s.on("end", () => res(Number(b.split(" ")[1]))); s.on("error", rej);
  });
}
test("traversal and non-video names are denied", async () => {
  for (const p of ["/night/media/../../../etc/passwd", "/night/media/%2e%2e/%2e%2e/x.mp4", "/night/media/..%2fescape.mp4", "/night/media/notes.txt", "/night/media/escape.mp4", "/night/media/v52/..%2f..%2floop-day-wall.mp4", "/night/media/loop-day-wall.mp4%00.html"])
    assert.equal(await rawGet(p), 404, p);
});

test("posters (webp) under night/ are on the static allow-list; other folders stay closed", async () => {
  const { staticOk } = await import(PROXY);
  assert.ok(staticOk("night/media/poster/loop-day-phone.webp"));
  assert.ok(!staticOk("night/media/loop-day-phone.mp4"), "videos never come from the repo tree");
  assert.ok(!staticOk("data/x.webp"));
  const r = await fetch(P.base + "/night/media/poster/loop-day-wall.webp");
  assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/webp"); await r.arrayBuffer();
});

test("caps.json: the proxy says video:true when its private folder has loops, false when it has none", async () => {
  const r = await fetch(P.base + "/night/media/caps.json");
  assert.equal(r.status, 200); { const j = await r.json(); assert.equal(j.video, true); assert.ok(!("art" in j) || Array.isArray(j.art), "art list (WGPLAQ1) is an array of names"); }
  const { nightMediaAvailable } = await import(PROXY);
  assert.equal(nightMediaAvailable(tmp("lhvid1-empty-")), false);
  assert.equal(nightMediaAvailable("/nonexistent-lhvid1"), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT, "night/media/caps.json"), "utf8")), { video: false }, "Pages serves video:false");
});

test("pages never set a video src before the capability answer (no mp4 request on Pages)", () => {
  const scene = fs.readFileSync(path.join(ROOT, "night/scene.html"), "utf8");
  assert.equal((scene.match(/createElement\('video'\)/g) || []).length, 4);
  assert.doesNotMatch(scene, /\bv\.src\s*=\s*\(window\.VID|<source|s\.src=/, "every scene video goes through vsrc()");
  assert.match(scene, /fetch\('media\/caps\.json'/);
  const lh = fs.readFileSync(path.join(ROOT, "livinghouse/index.html"), "utf8");
  for (const tag of lh.match(/<video[^>]*>/g) || []) { assert.doesNotMatch(tag, /\ssrc=/, tag); assert.match(tag, /poster=/, tag); assert.match(tag, /onerror=/, tag); }
  const mo = fs.readFileSync(path.join(ROOT, "month-theme/month-overlay.js"), "utf8");
  assert.doesNotMatch(mo, /v\.src = base/); assert.match(mo, /v\.onerror/); assert.match(mo, /caps\.json/);
});

/* LHVID1' · Atlas ruling: the committed exact list, the media-folder audit, and HEAD == GET with no token */
test("allow.json: exactly the 31 loop names, .mp4 only, under night/media (month-theme/media empty)", async () => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "night/media/allow.json"), "utf8"));
  assert.equal(j["night/media"].length, 31); assert.equal(new Set(j["night/media"]).size, 31);
  for (const n of j["night/media"]) assert.match(n, /^(?:v52\/)?[A-Za-z0-9_-]+\.mp4$/);
  assert.deepEqual(j["month-theme/media"], []);
  const { NIGHT_ALLOW } = await import(PROXY); assert.equal(NIGHT_ALLOW.size, 31);
});
test("media-folder audit: only listed names count; extras, symlinks and other files are refused (counts only)", async () => {
  const { auditNightMedia } = await import(PROXY);
  assert.deepEqual(auditNightMedia(MEDIA), { ok: 2, refused: 4 }, "notes.txt, unlisted-clip.mp4, escape.mp4, loop-dusk-wall.mp4 symlink");
  const clean = tmp("lhvid1-clean-"); fs.writeFileSync(path.join(clean, "fire-black.mp4"), "x");
  assert.deepEqual(auditNightMedia(clean), { ok: 1, refused: 0 });
  assert.match(P.log(), /night media: 2 listed loop\(s\) present, 4 other entries refused/, "startup prints counts");
  assert.doesNotMatch(P.log(), /unlisted-clip|notes\.txt|escape/, "startup never prints a file name");
});
test("no token: listed mp4s serve on HEAD and GET alike; nothing else under night/ or month-theme/ serves a video", async () => {
  const st = async (m, p) => { const r = await fetch(P.base + p, { method: m }); await r.arrayBuffer(); return [r.status, r.headers.get("content-length"), r.headers.get("content-type")]; };
  for (const p of ["/night/media/loop-day-wall.mp4", "/night/media/v52/loop-phone.mp4"]) {
    const g = await st("GET", p), h = await st("HEAD", p);
    assert.equal(g[0], 200, p); assert.deepEqual(h, g, "HEAD matches GET: " + p);
  }
  for (const p of ["/night/media/unlisted-clip.mp4", "/night/media/escape.mp4", "/night/media/loop-dusk-wall.mp4", "/night/media/notes.txt",
    "/night/media/loop-day-wall.MP4", "/night/media/loop-day-wall.mov", "/night/media/loop-day-wall.webm", "/night/media/", "/night/media", "/night/",
    "/night/media/v52/", "/month-theme/media/loop-day-wall.mp4", "/month-theme/loop-day-wall.mp4", "/night/loop-day-wall.mp4",
    "/night/media/missing.mp4", "/night/SOUND-CREDITS.md", "/month-theme/x.mp4", "/night/media/v52/unlisted.mp4"]) {
    const g = await st("GET", p), h = await st("HEAD", p);
    assert.equal(g[0], 404, "GET " + p); assert.equal(h[0], g[0], "HEAD " + p);
    assert.notEqual(g[2], "video/mp4", p);
  }
  /* every non-mp4 under night/ or month-theme/ that serves without a token is public page code that Pages already serves */
  const PAGE = /\.(?:html|js|css|png|webp|mp3|json)$/;
  for (const d of ["night", "month-theme"]) for (const f of fs.readdirSync(path.join(ROOT, d), { recursive: true })) {
    const rel = d + "/" + f.split(path.sep).join("/"); if (fs.statSync(path.join(ROOT, rel)).isDirectory()) continue;
    const g = await st("GET", "/" + rel), h = await st("HEAD", "/" + rel);
    assert.equal(h[0], g[0], "HEAD == GET " + rel);
    if (g[0] === 200) { assert.match(rel, PAGE, "only public page code serves: " + rel); assert.ok(!rel.endsWith(".mp4")); }
  }
  const c = await st("HEAD", "/night/media/caps.json"); assert.equal(c[0], 200);
});

/* LHVID1'' · Alfred 0803 condition 5: the tokenless night/ + month-theme/ static path serves only files tracked at HEAD, unmodified */
const sget = async (base, p, m = "GET") => { const r = await fetch(base + p, { method: m }); await r.arrayBuffer(); return r.status; };
const firstTracked = () => {
  for (const d of ["night", "month-theme"]) for (const f of fs.readdirSync(path.join(ROOT, d), { recursive: true })) {
    const rel = d + "/" + f.split(path.sep).join("/");
    if (/\.(?:js|css|html)$/.test(rel) && fs.statSync(path.join(ROOT, rel)).isFile() && !fs.lstatSync(path.join(ROOT, rel)).isSymbolicLink()) return rel;
  }
};
test("scene static: an untracked night/x.js is 404 without the token (GET and HEAD); a tracked file is 200", async () => {
  const x = path.join(ROOT, "night", "lhvid1-untracked-x.js");
  fs.writeFileSync(x, "/* untracked */\n");
  try {
    assert.equal(await sget(P.base, "/night/lhvid1-untracked-x.js"), 404);
    assert.equal(await sget(P.base, "/night/lhvid1-untracked-x.js", "HEAD"), 404);
  } finally { fs.rmSync(x, { force: true }); }
  const t = firstTracked(); assert.ok(t, "a tracked scene file exists");
  assert.equal(await sget(P.base, "/" + t), 200, t);
  assert.equal(await sget(P.base, "/" + t, "HEAD"), 200, t);
  assert.match(P.log(), /scene static: \d+ HEAD-tracked file\(s\)/);
});
test("scene static: a tracked file modified in the worktree is refused (temp repo + sceneServeOk/loadTrackedScene)", async () => {
  const { loadTrackedScene, sceneServeOk } = await import(PROXY);
  const { execFileSync } = await import("node:child_process");
  const r = tmp("lhvid1-repo-"); const g = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.hooksPath=/dev/null", ...a], { cwd: r, stdio: "ignore" });
  fs.mkdirSync(path.join(r, "night")); fs.mkdirSync(path.join(r, "month-theme"));
  fs.writeFileSync(path.join(r, "night/a.js"), "a\n"); fs.writeFileSync(path.join(r, "night/b.js"), "b\n"); fs.writeFileSync(path.join(r, "month-theme/c.css"), "c\n");
  g("init", "-q"); g("add", "."); g("commit", "-qm", "t");
  fs.writeFileSync(path.join(r, "night/b.js"), "b changed\n");     /* modified, unstaged */
  fs.writeFileSync(path.join(r, "night/u.js"), "untracked\n");
  const set = await loadTrackedScene(r);
  assert.ok(set && set.has("night/a.js") && set.has("month-theme/c.css"));
  assert.ok(!set.has("night/b.js"), "modified vs HEAD dropped at startup");
  assert.ok(!set.has("night/u.js"), "untracked never in the set");
  assert.equal(sceneServeOk("night/a.js", fs.readFileSync(path.join(r, "night/a.js")), set), true);
  assert.equal(sceneServeOk("night/a.js", Buffer.from("edited after startup\n"), set), false, "edited after startup: hash mismatch refused");
  assert.equal(sceneServeOk("night/u.js", Buffer.from("untracked\n"), set), false);
  assert.equal(sceneServeOk("index.html", Buffer.from("x"), set), true, "outside night/ + month-theme/ unaffected");
});
test("scene static: git unavailable -> the set is null and every night/ + month-theme/ static file is refused", async () => {
  const { loadTrackedScene, sceneServeOk } = await import(PROXY);
  assert.equal(await loadTrackedScene(ROOT, { gitBin: "/nonexistent/git" }), null);
  const nr = tmp("lhvid1-norepo-"); assert.equal(await loadTrackedScene(nr), null, "not a repo: null");
  assert.equal(sceneServeOk("night/x.js", Buffer.from("x"), null), false);
  const t = firstTracked();
  const home = fakeHome(), emptyBin = tmp("lhvid1-nogit-");
  const env = { ...process.env, HOME: home, PATH: emptyBin }; delete env.NEST_PROXY_TOKEN; delete env.NEST_REFRESH_TOKEN;
  const Q = spawnListening(process.execPath, [PROXY, "--host", "127.0.0.1", "--port", "0", "--night-media", MEDIA], { env });
  try {
    assert.ok(await Q.ready, "proxy starts without git");
    assert.match(Q.log(), /scene static: git unavailable/);
    assert.equal(await sget(Q.base, "/" + t), 404, "tracked scene file refused when git is unavailable");
    assert.equal(await sget(Q.base, "/" + t, "HEAD"), 404);
    assert.equal(await sget(Q.base, "/night/media/loop-day-wall.mp4"), 200, "private media mp4 route unchanged");
  } finally { Q.child.kill(); await Q.exited; }
});
