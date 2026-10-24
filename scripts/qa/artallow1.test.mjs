/* LIVEWX2 · Alfred P1/P2 HTTP negatives (node --test scripts/qa/artallow1.test.mjs). Prism art is served only from the exact
   path + sha256 list <night-media>/art-halloween-allow.json (private folder, never git); caps.json names no art (artH keys only); the hub static path
   serves exactly livinghouse/clock.js and livinghouse/scene-packs.js and nothing else under livinghouse/.
   Temp HOME and a temp media folder: one listed file copied with its real bytes when the private art folder is on this box
   (else a synthetic list covers the same cases). The list is written into the temp media folder, as on the hub. Failure messages carry case labels, never file names. */
import { spawnListening } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROXY = path.join(ROOT, "scripts/nest-webrtc-proxy.mjs");
for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
const MADE = [];
const tmp = (pfx) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), pfx)); MADE.push(d); return d; };
const cleanup = () => { for (const d of MADE.splice(0)) try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* gone */ } };
process.on("exit", cleanup);

/* the account's own home (passwd), not $HOME: th.sh runs tests under a temp HOME; read only, nothing is written there */
const PRIVNM = path.join(os.userInfo().homedir, ".local/share/wardos-private/night-media"), PRIV = path.join(PRIVNM, "art/halloween");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const SYNTH = Object.fromEntries(Array.from({ length: 120 }, (_, i) => ["kidboards/zz-synth-" + i + "-wall.webp", sha("synthetic " + i)]));
const LIST = (() => { try { return JSON.parse(fs.readFileSync(path.join(PRIVNM, "art-halloween-allow.json"), "utf8")).files; } catch { return SYNTH; } })();
const NAMES = Object.keys(LIST).filter((n) => !/\.(?:mp4|webm|json)$/.test(n));
/* the smallest listed still whose private copy has the listed bytes; null off this box */
function pickReal() {
  let best = null;
  for (const n of NAMES) { const f = path.join(PRIV, n); try { const s = fs.statSync(f); if (s.isFile() && (!best || s.size < best.size) && sha(fs.readFileSync(f)) === LIST[n]) best = { n, f, size: s.size }; } catch { /* absent */ } }
  return best;
}
const REAL = pickReal();
const [WRONG, SYM, UNLISTED] = [NAMES.find((n) => !REAL || n !== REAL.n), NAMES.filter((n) => !REAL || n !== REAL.n)[1], "kidboards/zz-unlisted-plate.webp"];

let P, MEDIA;
test.before(async () => {
  const home = tmp("artallow1-home-"), cfg = path.join(home, ".config/wardos");
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, "nest-refresh.token"), "fake-refresh\n");
  fs.writeFileSync(path.join(cfg, "nest-sdm.json"), '{"projectId":"p","clientId":"c","clientSecret":"s"}');
  fs.writeFileSync(path.join(cfg, "nest-device.token"), "test-artallow1-key-0123456789abcdef\n", { mode: 0o600 });
  MEDIA = tmp("artallow1-media-");
  fs.writeFileSync(path.join(MEDIA, "art-halloween-allow.json"), JSON.stringify({ files: LIST }));
  const art = path.join(MEDIA, "art/halloween"), put = (n, b) => { fs.mkdirSync(path.dirname(path.join(art, n)), { recursive: true }); fs.writeFileSync(path.join(art, n), b); };
  if (REAL) put(REAL.n, fs.readFileSync(REAL.f));
  put(WRONG, "listed path, wrong bytes");
  put(UNLISTED, "right shape, not on the list");
  const out = tmp("artallow1-out-"); fs.writeFileSync(path.join(out, "x.webp"), REAL ? fs.readFileSync(REAL.f) : "x");
  fs.mkdirSync(path.dirname(path.join(art, SYM)), { recursive: true }); fs.symlinkSync(REAL ? REAL.f : path.join(out, "x.webp"), path.join(art, SYM));
  const env = { ...process.env, HOME: home }; delete env.NEST_PROXY_TOKEN; delete env.NEST_REFRESH_TOKEN;
  P = spawnListening("node", [PROXY, "--host", "127.0.0.1", "--port", "0", "--night-media", MEDIA], { env });
  if (!(await P.ready)) throw new Error("proxy did not start");
});
test.after(async () => { if (P) { P.child.kill(); await P.exited; } cleanup(); });

const get = async (p) => { const r = await fetch(P.base + p); const b = Buffer.from(await r.arrayBuffer()); return [r.status, b]; };
function rawGet(p) {
  return new Promise((res, rej) => {
    const s = net.connect(P.port, "127.0.0.1", () => s.write(`GET ${p} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`));
    let b = ""; s.on("data", (d) => (b += d)); s.on("end", () => res(Number(b.split(" ")[1]))); s.on("error", rej);
  });
}
const A = "/night/media/art/halloween/";

test("the allowlist is exact and private: every entry a plain relative path with a sha256; no copy in git; no list = nothing serves", async () => {
  assert.equal(fs.existsSync(path.join(ROOT, "night/media/art-halloween-allow.json")), false, "list stays out of the repo");
  const { artFilesFor, halloweenArtList } = await import(PROXY); const empty = tmp("artallow1-nolist-");
  assert.equal(artFilesFor(empty).size, 0, "no list file"); assert.deepEqual(halloweenArtList(empty), [], "nothing listed");
  assert.ok(Object.keys(LIST).length > 100, "list loaded");
  for (const [n, h] of Object.entries(LIST)) { assert.match(h, /^[0-9a-f]{64}$/, "sha shape"); assert.ok(!n.includes("..") && !n.startsWith("/") && !n.includes("\\"), "plain path"); }
});
test("a listed file with its listed bytes serves (only when the private art is on this box)", { skip: !REAL && "no private art on this box" }, async () => {
  const [s, b] = await get(A + REAL.n); assert.equal(s, 200, "listed+sha"); assert.equal(sha(b), LIST[REAL.n], "same bytes");
});
test("HTTP negatives: unlisted, wrong sha, symlink and traversal are 404", async () => {
  assert.equal((await get(A + UNLISTED))[0], 404, "unlisted name");
  assert.equal((await get(A + WRONG))[0], 404, "listed name, wrong bytes");
  assert.equal((await get(A + SYM))[0], 404, "listed name as a symlink");
  for (const [i, p] of [A + "../caps.json", A + "%2e%2e/%2e%2e/art-halloween-allow.json", "/night/media/art-halloween-allow.json", A + "../../art-halloween-allow.json", A + "kidboards/..%2f..%2f..%2fcaps.json", A + "kidboards/", A,
    A + (REAL ? REAL.n : WRONG) + "%00.webp", A + ".hidden.webp", A + "kidboards//x.webp"].entries())
    assert.equal(await rawGet(p), 404, "traversal case " + i);
});
test("caps.json names no art: artH carries keys only, exactly the served files", async () => {
  const [s, b] = await get("/night/media/caps.json"); assert.equal(s, 200);
  const txt = b.toString("utf8"), j = JSON.parse(txt);
  assert.equal("art" in j, false, "no art name list"); assert.ok(Array.isArray(j.artH), "artH array");
  for (const k of j.artH) assert.match(k, /^[0-9a-f]{16}$/, "key shape");
  assert.doesNotMatch(txt, /\.(?:webp|png|mp4|webm)|kidboards|backgrounds|overlays/, "no names or folders");
  const { artKey } = await import(PROXY);
  assert.deepEqual(j.artH, REAL ? [artKey(REAL.n)] : [], "only the byte-matched file is keyed");
});
test("artKey: the proxy and wg-assets.js compute the same key (the page keys the names it already holds)", async () => {
  const { artKey } = await import(PROXY);
  const src = fs.readFileSync(path.join(ROOT, "wg-assets.js"), "utf8"), m = /function artKey\(n\) \{[\s\S]*?\n  \}/.exec(src);
  assert.ok(m, "wg-assets artKey found");
  const ctx = vm.createContext({}); vm.runInContext(m[0] + "; this.k = artKey;", ctx);
  for (const n of [...NAMES.slice(0, 40), "", "a", "kidboards/x-wall-costume.webp"]) assert.equal(ctx.k(n), artKey(n), "parity");
  assert.equal(new Set(NAMES.map(artKey)).size, NAMES.length, "no key collisions on the list");
});
test("hub static path: exactly livinghouse/clock.js and livinghouse/scene-packs.js; every other livinghouse/ path is 404", async () => {
  const { staticOk } = await import(PROXY);
  for (const ok of ["livinghouse/clock.js", "livinghouse/scene-packs.js"]) {
    assert.ok(staticOk(ok), ok); const [s, b] = await get("/" + ok); assert.equal(s, 200, ok);
    assert.equal(sha(b), sha(fs.readFileSync(path.join(ROOT, ok))), ok + " bytes");
  }
  for (const no of ["livinghouse/lh.js", "livinghouse/moon-real.js", "livinghouse/lh.css", "livinghouse/index.html", "livinghouse/clock.jsx", "livinghouse/clock.js.map",
    "livinghouse/sub/clock.js", "livinghouse/xclock.js", "livinghouse/art/x.webp", "livewx-core.js.bak"]) {
    assert.equal(staticOk(no), false, no); assert.equal((await get("/" + no))[0], 404, no);
  }
  for (const p of ["/livinghouse/../livinghouse/lh.js", "/livinghouse/%2e%2e/scripts/nest-webrtc-proxy.mjs", "/livinghouse//clock.js", "/livinghouse/clock.js/", "/livinghouse/clock.js%2f"])
    assert.equal(await rawGet(p), 404, p);
});
