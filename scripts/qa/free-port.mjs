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
