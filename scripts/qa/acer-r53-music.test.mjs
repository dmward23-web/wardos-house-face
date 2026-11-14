/* Music slot, offline line, and stubbed Spotify controls. No network. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("r53 Music sits in the locked slot and the launch grid ends on the safe line", () => {
  const css = read("hub-compose.css");
  assert.match(css, /#hub-spotify-tile[\s\S]*left:\s*48px[\s\S]*top:\s*616px[\s\S]*width:\s*588px[\s\S]*height:\s*192px/);
  assert.match(css, /\.hub-launch[\s\S]*left:\s*48px[\s\S]*top:\s*832px[\s\S]*210px[\s\S]*88px[\s\S]*column-gap:\s*20px[\s\S]*row-gap:\s*24px/);
  const html = read("sheet-index.html");
  assert.equal((html.match(/id="hub-spotify-tile"/g) || []).length, 1);
  assert.ok(html.indexOf('id="hub-spotify-tile"') < html.indexOf('class="tile-grid'));
});

function spotify() {
  const calls = [];
  const store = { "wardos-lights-proxy-token": "hub-key-hub-key-hub" };
  const ctx = {
    URL, Promise, JSON, Date, Math, Object, Array, String, Number, Error,
    setTimeout() { return 0; },
    clearTimeout() {},
    setInterval() { return 0; },
    clearInterval() {},
    addEventListener() {},
    document: { hidden: false, addEventListener() {}, querySelectorAll() { return []; }, createElement() { return { style: {}, getContext() { return null; } }; } },
    location: { href: "http://127.0.0.1/sheet-index.html", hostname: "127.0.0.1", pathname: "/sheet-index.html", search: "" },
    localStorage: { getItem(k) { return store[k] || null; }, setItem(k, v) { store[k] = v; } },
    fetch(url, opt) {
      calls.push({ url: String(url), body: opt && opt.body ? JSON.parse(opt.body) : null });
      const action = opt && opt.body ? JSON.parse(opt.body).action : "play";
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          state: action === "pause" ? "paused" : "playing",
          player: {
            active: true,
            isPlaying: action !== "pause",
            item: { name: "Track", artists: "Band", durationMs: 180000 },
            device: { id: action === "transfer" ? "room-2" : "room-1", name: "Kitchen" }
          },
          rooms: [{ id: "room-1", name: "Kitchen", room: true }, { id: "room-2", name: "Den", room: true }]
        })
      });
    },
    HouseHub: { lights() { return "http://hub.test"; }, okForKey() { return true; } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-spotify.js"), ctx);
  return { api: ctx.HouseSpotify, calls };
}

test("r53 play, pause, next, and room transfer hit the stubbed Spotify route", async () => {
  const { api, calls } = spotify();
  await api.act("play");
  await api.act("pause");
  await api.act("next");
  await api.act("transfer", { deviceId: "room-2", play: true });
  const posts = calls.filter((c) => c.url.endsWith("/api/spotify/control"));
  assert.deepEqual(posts.map((c) => c.body.action), ["play", "pause", "next", "transfer"]);
  assert.equal(posts[3].body.deviceId, "room-2");
  assert.equal(calls.some((c) => /spotify\.com|8788/.test(c.url)), false);
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

test("r53 the wall shows Music, one offline line, and no lights bar", { skip: browser ? false : "SKIP no playwright" }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r53_wall.py")], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-700) + (r.stdout || "").slice(-500));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.ok(o.groceries.bottom <= 1032, JSON.stringify(o.groceries));
  for (const node of o.groceries.nodes) {
    assert.ok(node.w >= 64 && node.h >= 64, JSON.stringify(node));
    assert.ok(node.y <= 1032 && node.x >= 48, JSON.stringify(node));
  }
  assert.equal(o.cam.navigated, true, JSON.stringify(o.cam));
  assert.ok(o.home.ms <= 2500, JSON.stringify(o.home));
  const m = o.music;
  assert.equal(m.visible, true, JSON.stringify(m));
  assert.ok(m.h >= 64 && m.x >= 48 && m.y >= 48 && m.bottom <= 1032 && m.right <= 1872, JSON.stringify(m));
  assert.ok(Math.abs(m.x - 48) <= 2 && Math.abs(m.y - 616) <= 2 && Math.abs(m.w - 588) <= 2 && Math.abs(m.h - 192) <= 2, JSON.stringify(m));
  assert.equal(m.offline, "Music offline");
  assert.equal(m.buttons.length, 3, JSON.stringify(m.buttons));
  for (const b of m.buttons) {
    assert.ok(b.w >= 64 && b.h >= 64, JSON.stringify(b));
    assert.equal(b.disabled, true, JSON.stringify(b));
  }
  assert.equal(o.lights, false, "lights bar");
  assert.equal(o.offline, "House box offline · calendar back when it reconnects");
  assert.equal(o.calendarPlates, 0, "calendar plates " + o.calendarPlates);
  const launch = o.launch;
  assert.ok(Math.abs(launch.y - 832) <= 2 && Math.abs(launch.bottom - 1032) <= 2, JSON.stringify(launch));
});
