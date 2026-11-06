/* Static pin of the clean runtime bundle. Does not read or copy the excluded Sensi file body. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = path.join(ROOT, "ops/box-recover/runtime-src");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "ops/box-recover/MANIFEST.json"), "utf8"));

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("clean runtime sources match the manifest and do not include Sensi", () => {
  assert.equal(MANIFEST.pin_complete, false);
  assert.equal(MANIFEST.not_gate_ready_for_execute, true);
  assert.equal(MANIFEST.runtime_bundle_sha256, "46bc87d451344e3c0c1c66748236bea0a36946175ed5df58558acef03752b4d1");
  const bundled = fs.readdirSync(SRC).filter((n) => n.endsWith(".mjs") || n.endsWith(".py") || n.endsWith(".sh"));
  assert.equal(bundled.includes("sensi-control.mjs"), false);
  const rows = new Map(MANIFEST.files.map((row) => [path.basename(row.path), row]));
  for (const name of bundled) {
    const row = rows.get(name);
    assert.ok(row, name);
    assert.equal(sha(path.join(SRC, name)), row.sha256, name);
    assert.notEqual(row.security_review, "open");
  }
  const sensi = rows.get("sensi-control.mjs");
  assert.equal(sensi.sha256, "54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc");
  assert.equal(sensi.security_review, "open");
  assert.equal(sensi.distribution, "hash-only");
  assert.equal(sensi.bytes_in_this_artifact, false);
  const repoHash = sha(path.join(ROOT, "scripts/sensi-control.mjs"));
  assert.equal(repoHash, sensi.sha256);
});

test("static imports from the bundled lights process name Sensi and no other missing local file", () => {
  const text = fs.readFileSync(path.join(SRC, "lights-write-proxy.mjs"), "utf8");
  const specs = [...text.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((m) => m[1].replace(/^\.\//, ""));
  assert.ok(specs.includes("sensi-control.mjs"));
  for (const spec of specs) {
    if (spec === "sensi-control.mjs") continue;
    assert.equal(fs.existsSync(path.join(SRC, spec)), true, spec);
  }
  const feed = fs.readFileSync(path.join(SRC, "private-feed.mjs"), "utf8");
  assert.equal(feed.includes("[a-z0-9-]{1,40}") && feed.includes(".jpg"), true);
  assert.doesNotMatch(fs.readFileSync(path.join(SRC, "kasa-daemon.py"), "utf8"), /CLIENT_SECRET/);
});
