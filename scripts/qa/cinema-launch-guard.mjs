/* The launch-failure guard. A child process runs this file so a leaked server
   fails the parent at 30s instead of holding the suite open. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BASE_SHA = "bf976526d4072113732340853fe37a41e725803f";
export const CHROME = ["/usr/bin/google-chrome", "/usr/local/bin/google-chrome"].find((p) => fs.existsSync(p));

function baseBlob(rel) {
  const r = spawnSync("git", ["show", BASE_SHA + ":" + rel], { cwd: ROOT, encoding: "buffer" });
  return r.status === 0 ? r.stdout : null;
}

export function serve() {
  const types = {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2",
    ".mp4": "video/mp4", ".cube": "text/plain"
  };
  const cache = new Map();
  const srv = http.createServer((q, res) => {
    const u = new URL(q.url, "http://127.0.0.1");
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (rel.includes("..")) { res.writeHead(403); res.end(); return; }
    const send = (buf, ext) => {
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": "no-store", "Content-Length": buf.length });
      res.end(buf);
    };
    if (String(q.headers["x-wall-bytes"] || "") === "base") {
      if (!cache.has(rel)) cache.set(rel, baseBlob(rel));
      const blob = cache.get(rel);
      if (!blob) { res.writeHead(404); res.end(); return; }
      send(blob, path.extname(rel));
      return;
    }
    const fp = path.join(ROOT, path.normalize(rel));
    if (!fp.startsWith(ROOT + path.sep) && fp !== ROOT) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      send(buf, path.extname(fp));
    });
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}

export function launchChrome(bin, opts) {
  /* CLASSICRASTER1: two screenshots of the same classic plate were not the same blit.
     Skia's GPU raster path, a multi-thread CPU raster, and the GPU compositor quantize
     the cover-scaled webp and the header gradients a level or two apart between
     navigations in one browser. CI run 1 on 7e35c464 was 831231 pixels at exactly one
     level and 122 at two or more. The classic compare opts in (stableRaster). One
     software raster thread, software compositing, portable Skia, grayscale text, and
     no font hinting make that blit stable. WebGL stays on swiftshader. These flags
     stay off the other chromes: software compositing stretched a ?gl=soft retry
     burst past the 2500 ms cap. */
  const args = [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
      "--remote-debugging-port=0", "--remote-allow-origins=*",
      "--window-size=1920,1080", "--force-device-scale-factor=1", "--force-color-profile=srgb"
  ];
  if (opts && opts.stableRaster) {
    args.push(
      "--disable-gpu-rasterization", "--disable-gpu-compositing", "--num-raster-threads=1",
      "--disable-lcd-text", "--font-render-hinting=none", "--disable-font-subpixel-positioning",
      "--disable-skia-runtime-opts"
    );
  }
  args.push(
      "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
      "--hide-scrollbars", "--mute-audio", "--disable-gpu-sandbox",
      "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
      "about:blank"
  );
  return new Promise((resolve, reject) => {
    const proc = spawn(bin || CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        try { proc.kill("SIGKILL"); } catch (e) { /* already gone */ }
        reject(err);
      } else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("chrome did not open a devtools port")), 20000);
    const on = (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) finish(null, { proc, port: Number(m[1]) });
    };
    proc.stdout.on("data", on);
    proc.stderr.on("data", on);
    proc.on("error", (err) => finish(err));
    proc.on("exit", (code) => finish(new Error("chrome exit " + code)));
  });
}

/* mode "leak" leaves the server open. The parent must see that child fail, not exit 0. */
export async function runLaunchGuard(mode) {
  let srv = null;
  try {
    srv = await serve();
    await launchChrome("/bin/true").then(() => { throw new Error("launch returned"); }, (err) => console.log("forced launch failure:", err.message));
  } finally {
    if (srv && mode !== "leak") srv.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("cinema-launch-guard.mjs")) {
  await runLaunchGuard(process.argv[2] || "close");
}
