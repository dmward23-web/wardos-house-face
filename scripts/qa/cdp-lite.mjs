/* CDP page helper shared with the cinema browser tests: Chrome's devtools socket, no puppeteer-core. */
import crypto from "node:crypto";
import net from "node:net";
import { spawn } from "node:child_process";

function openSocket(url) {
  if (typeof WebSocket === "function") return new WebSocket(url);
  const u = new URL(url);
  const key = crypto.randomBytes(16).toString("base64");
  const socket = net.connect(Number(u.port || 80), u.hostname);
  const listeners = {};
  let pending = Buffer.alloc(0);
  let handshake = true;
  let frag = [];
  const emit = (type, ev) => { for (const fn of listeners[type] || []) fn(ev); };
  const ws = {
    addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
    send(data) {
      const payload = Buffer.from(String(data));
      const mask = crypto.randomBytes(4);
      const len = payload.length;
      let header;
      if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
      else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
      else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
      const masked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
      socket.write(Buffer.concat([header, mask, masked]));
    },
    close() { try { socket.end(); } catch (e) { /* already closed */ } }
  };
  socket.on("error", (err) => emit("error", err));
  socket.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    if (handshake) {
      const end = pending.indexOf("\r\n\r\n");
      if (end < 0) return;
      const head = pending.slice(0, end).toString("latin1");
      pending = pending.slice(end + 4);
      handshake = false;
      if (!/^HTTP\/1\.[01] 101 /.test(head)) { emit("error", new Error("socket upgrade failed")); socket.end(); return; }
      emit("open", {});
    }
    for (;;) {
      if (pending.length < 2) return;
      const b0 = pending[0];
      const b1 = pending[1];
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (pending.length < 4) return; len = pending.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (pending.length < 10) return; len = Number(pending.readBigUInt64BE(2)); off = 10; }
      const masked = (b1 & 0x80) !== 0;
      if (masked) off += 4;
      if (pending.length < off + len) return;
      let payload = pending.slice(off, off + len);
      if (masked) {
        const mask = pending.slice(off - 4, off);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      pending = pending.slice(off + len);
      const opcode = b0 & 0x0f;
      if (opcode === 1 || opcode === 0) {
        frag.push(payload);
        if ((b0 & 0x80) !== 0) { const msg = Buffer.concat(frag).toString("utf8"); frag = []; emit("message", { data: msg }); }
      } else if (opcode === 8) { socket.end(); emit("close", {}); }
      else if (opcode === 9) socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
    }
  });
  socket.write("GET " + u.pathname + u.search + " HTTP/1.1\r\nHost: " + u.host + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + key + "\r\nSec-WebSocket-Version: 13\r\n\r\n");
  return ws;
}

function cdpSocket(ws) {
  let n = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result || {});
    }
  });
  return {
    send(method, params, timeout) {
      const id = ++n;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("cdp timeout " + method)), timeout || 20000);
        pending.set(id, {
          resolve: (v) => { clearTimeout(t); resolve(v); },
          reject: (e) => { clearTimeout(t); reject(e); }
        });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
  };
}

function expr(fn, args) {
  if (typeof fn !== "function") return String(fn);
  return "(" + fn.toString() + ")(" + (args || []).map((a) => JSON.stringify(a)).join(",") + ")";
}

export function launchChrome(executablePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(executablePath, [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
      "--remote-debugging-port=0", "--remote-allow-origins=*",
      "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
      "--disable-gpu-sandbox", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
      "about:blank"
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("chrome did not open a devtools port")); }, 20000);
    const on = (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) { clearTimeout(timer); resolve({ proc, port: Number(m[1]), async close() { proc.kill("SIGKILL"); } }); }
    };
    proc.stdout.on("data", on);
    proc.stderr.on("data", on);
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error("chrome exit " + code)); });
  });
}

export async function openPage(port) {
  const created = await (await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  const ws = openSocket(created.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  const c = cdpSocket(ws);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  const page = {
    async setViewport(size) {
      await c.send("Emulation.setDeviceMetricsOverride", { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false });
    },
    async emulateMediaFeatures(features) {
      await c.send("Emulation.setEmulatedMedia", { features });
    },
    async evaluateOnNewDocument(fn, ...args) {
      await c.send("Page.addScriptToEvaluateOnNewDocument", { source: expr(fn, args) });
    },
    async goto(url) {
      const loaded = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("wait Page.loadEventFired")), 30000);
        const prev = ws.addEventListener;
        ws.addEventListener("message", function on(ev) {
          const msg = JSON.parse(ev.data);
          if (msg.method === "Page.loadEventFired") { clearTimeout(t); resolve(); }
        });
        void prev;
      });
      await c.send("Page.navigate", { url });
      await loaded;
    },
    async evaluate(fn, ...args) {
      const r = await c.send("Runtime.evaluate", { expression: expr(fn, args), returnByValue: true, awaitPromise: true }, 45000);
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result && r.result.value;
    },
    async waitForFunction(fn, opts, ...args) {
      const timeout = (opts && opts.timeout) || 30000;
      const polling = (opts && opts.polling) || 100;
      const body = expr(fn, args);
      await page.evaluate(`new Promise((res, rej) => { const t0 = Date.now(); const step = () => { let ok = false; try { ok = (${body}); } catch (e) {} if (ok) return res(true); if (Date.now() - t0 > ${timeout}) return rej(new Error("waitForFunction")); setTimeout(step, ${polling}); }; step(); })`);
    },
    async close() {
      try { await c.send("Target.closeTarget", { targetId: created.id }); } catch (e) { /* already gone */ }
      try { ws.close(); } catch (e) { /* closed */ }
    }
  };
  return page;
}
