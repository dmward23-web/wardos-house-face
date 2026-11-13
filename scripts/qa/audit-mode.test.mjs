/* AUDIT1 · ?audit=1 must not let a non-GET leave the page. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "house-audit.js"), "utf8");

function boot(search) {
  const seen = [];
  const realFetch = (input, init) => {
    const method = (init && init.method) || "GET";
    seen.push(method.toUpperCase());
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ taps: {} }) });
  };
  const context = {
    window: null,
    WARDOS_AUDIT: false,
    location: { search: search },
    document: { documentElement: { getAttribute: () => null, setAttribute() {} } },
    Response: class Response {
      constructor(body, init) { this.body = body; this.status = init.status; this.ok = init.status < 400; }
      json() { return Promise.resolve({}); }
    },
    XMLHttpRequest: function XMLHttpRequest() {},
    navigator: { sendBeacon: () => true },
    setTimeout,
    Promise
  };
  context.window = context;
  context.fetch = realFetch;
  context.XMLHttpRequest.prototype.open = function (method) { this._wardosMethod = method; };
  context.XMLHttpRequest.prototype.send = function () { seen.push(String(this._wardosMethod || "GET").toUpperCase()); };
  vm.createContext(context);
  vm.runInContext(SRC, context);
  return { context, seen };
}

test("audit mode blocks POST PUT PATCH DELETE and sendBeacon, and still allows GET", async () => {
  const { context, seen } = boot("?audit=1&freeze=1");
  assert.equal(context.HouseAudit.active(), true);
  assert.equal(context.HouseAudit.deny("POST"), true);
  await context.fetch("/api/taps", { method: "POST", body: "{}" });
  await context.fetch("/api/lights", { method: "PUT" });
  await context.fetch("/api/pair", { method: "POST" });
  await context.fetch("/wx", { method: "GET" });
  const xhr = new context.XMLHttpRequest();
  xhr.open("POST", "/api/taps");
  xhr.send("{}");
  assert.equal(context.navigator.sendBeacon("/api/taps", "{}"), true);
  assert.deepEqual(seen, ["GET"]);
});

test("without audit mode a POST reaches the network", async () => {
  const { context, seen } = boot("");
  assert.equal(context.HouseAudit.active(), false);
  await context.fetch("/api/taps", { method: "POST", body: "{}" });
  assert.deepEqual(seen, ["POST"]);
});

test("kid and sheet pages install the audit script before tapsync or the stage", () => {
  const taps = fs.readFileSync(path.join(ROOT, "house-tapsync.js"), "utf8");
  const stage = fs.readFileSync(path.join(ROOT, "wardos-stage.js"), "utf8");
  assert.match(taps, /house-audit\.js\?v=AUDIT1/);
  assert.match(stage, /house-audit\.js\?v=AUDIT1/);
  assert.match(stage, /audit on/);
});
