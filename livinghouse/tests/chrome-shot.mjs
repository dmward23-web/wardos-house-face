/* Headless Chrome helper for Living House stills and layout checks. No private feeds. */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export async function launchChrome(port) {
  /* /usr/local/bin/google-chrome pins remote debugging to 9222 and one profile.
     Call the stable binary with our own profile so a second run can pick a port. */
  const dir = `/tmp/lh-chrome-${port}`;
  const proc = spawn("/usr/bin/google-chrome-stable", [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--hide-scrollbars", "--mute-audio", "--no-first-run", "--no-default-browser-check",
    "--use-gl=angle", "--use-angle=swiftshader-webgl",
    `--user-data-dir=${dir}`, `--remote-debugging-port=${port}`,
    "--window-size=1920,1080", "about:blank",
  ], { stdio: "ignore" });
  let ws = "";
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) { ws = j.webSocketDebuggerUrl; break; }
    } catch (_) { /* booting */ }
    await delay(150);
  }
  if (!ws) { proc.kill("SIGKILL"); throw new Error("chrome did not open a debug port"); }
  return { proc, ws };
}

export function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const wait = new Map();
  const opened = new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) { const { res, rej } = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  });
  async function send(method, params, sessionId) {
    await opened;
    const id = ++seq;
    const p = new Promise((res, rej) => wait.set(id, { res, rej }));
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    return p;
  }
  return { send, close: () => ws.close() };
}

export async function openPage(browser, url, width, height) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: width < 700,
  }, sessionId);
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  await browser.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "window.__lhErr=[];addEventListener('error',function(e){window.__lhErr.push(String(e.message||e.error||'error'));});",
  }, sessionId);
  await browser.send("Page.navigate", { url }, sessionId);
  return { sessionId, targetId };
}

export async function closePage(browser, page) {
  try { await browser.send("Target.closeTarget", { targetId: page.targetId }); } catch (_) { /* already gone */ }
}

export async function evalJson(browser, sessionId, expression) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await browser.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result.value;
    } catch (e) {
      last = e;
      if (!/navigated or closed|Execution context was destroyed/.test(String(e))) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw last;
}

export async function shot(browser, sessionId, width, height) {
  const r = await browser.send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width, height, scale: 1 },
    captureBeyondViewport: true,
  }, sessionId);
  return Buffer.from(r.data, "base64");
}
