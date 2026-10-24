/* QA1 · a free loopback port chosen by the kernel (listen on 0), so parallel test files never collide with each other
   or with a fixed-port service on the box (the old 18000+random pick could land on a live scratch port). Sync on purpose:
   the callers build their child-process args synchronously. */
import { spawnSync } from "node:child_process";
export function freePortSync() {
  const r = spawnSync(process.execPath, ["-e", "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();})"], { encoding: "utf8" });
  const port = Number(r.stdout);
  if (!port) throw new Error("free-port: no port (" + (r.stderr || "").trim() + ")");
  return port;
}

/* LHVID1' flake fix · freePortSync() closes its probe socket before the child binds, so under load another parallel test can
   take the same port in between (the child dies with EADDRINUSE, or our /health poll hits the OTHER test's server), and the
   old 4-6 s fixed poll also ran out on a loaded box. spawnListening() removes both races: the child binds port 0 itself and
   we read the real port from its own "listening http://host:PORT" line; ready waits on that line (30 s cap), not a timer. */
import { spawn } from "node:child_process";
export function spawnListening(cmd, args, opts = {}, timeoutMs = 30000) {
  const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  const h = { child, port: 0, base: "", _buf: "", log: () => h._buf };
  h.exited = new Promise((r) => child.on("exit", (c) => r(c)));
  h.ready = new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), timeoutMs);
    const on = (d) => { h._buf += d; const m = !h.port && /listening http:\/\/[^\s]+?:(\d+)/.exec(h._buf); if (m) { h.port = Number(m[1]); h.base = `http://127.0.0.1:${h.port}`; clearTimeout(t); resolve(true); } };
    child.stdout.on("data", on); child.stderr.on("data", (d) => (h._buf += d));
    child.on("exit", () => { clearTimeout(t); resolve(!!h.port); });
  });
  return h;
}
