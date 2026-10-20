// node livinghouse/tests/lh-names.test.mjs
// P1 (Alfred 14:46): no private name and no hash of one ships in git. Private first names (roles partner, coparent,
// external, old key otherfamily) are read at run time only; with none, glassTitle's partner patterns are the fallback.
// Stand-ins only (Zedna, Yolanthe, Quill, Jones, Smith); the box's real names file is never read here (temp HOME).
import { assertSealed } from "../../scripts/qa/temp-home.mjs";   // TEMPHOME1: WARDOS_* unset and a temp HOME before any private-list reader loads
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
const TMP = mkdtempSync(join(tmpdir(), "lh-names-")); process.env.HOME = TMP;
const dir = fileURLToPath(new URL("..", import.meta.url));
assertSealed(); const R = createRequire(import.meta.url)("../lh-rules.js");
try {
  // 1. no 64-hex literal (a SHA-256 or similar digest) anywhere in livinghouse/ code, tests or pages
  const files = readdirSync(dir).filter((f) => /\.(js|html|css|md)$/.test(f)).concat(readdirSync(dir + "tests").filter((f) => /\.m?js$/.test(f)).map((f) => "tests/" + f));
  const HEX = new RegExp("[0-9a-fA-F]{" + 64 + "}");
  for (const f of files) assert.ok(!HEX.test(readFileSync(dir + f, "utf8")), "64-hex literal in livinghouse/" + f);
  assert.equal(R.sha256, undefined, "no hashing helper is exported");
  assert.ok(!/PRIV\s*=\s*\{/.test(readFileSync(dir + "lh-rules.js", "utf8")), "no name table in lh-rules.js");
  // 2. no names anywhere: nothing stripped, the partner patterns still say Dad
  R.setPrivateNames(null);
  assert.equal(R.stripPrivate("Lunch with Zedna"), "Lunch with Zedna");
  assert.equal(R.glassTitle("Example Fest with Zedna"), "Dad: Example Fest");
  assert.equal(R.glassTitle("Zedna + Dan Example Fest"), "Dad: Example Fest");
  // 3. names set at run time (tests / hub feed) are stripped, possessives too, case-insensitive, whole words only
  R.setPrivateNames(["Zedna", "Yolanthe Quill"]);
  assert.equal(R.stripPrivate("Dinner at Zedna's place"), "Dinner at place");
  assert.equal(R.stripPrivate("Yolanthe pickup"), "pickup");
  assert.equal(R.stripPrivate("Quillfeather day"), "Quillfeather day");
  assert.ok(!/Quill/.test(R.stripNamesakes("Hayes Quill bday")), "kid first name + private surname goes");
  assert.equal(R.stripNamesakes("Hayes Smith bday"), "Hayes Smith bday");
  // 4. browser shape: window.WARDOS_PRIVATE_NAMES.<role> (what the hub names route would deliver)
  R.setPrivateNames(null); globalThis.window = { WARDOS_PRIVATE_NAMES: { school: ["QXS"], coparent: ["Jones"] } };
  assert.equal(R.stripPrivate("Jones week plan"), "week plan");
  globalThis.window = { WARDOS_PRIVATE_NAMES: { school: ["QXS"] } };   // route serves school only: no names, fallback stays
  R.setPrivateNames(null);
  assert.equal(R.stripPrivate("Jones week plan"), "Jones week plan");
  delete globalThis.window;
  // 5. node sources: WARDOS_NAMES and a private-names.tsv under HOME (stand-in file in the temp HOME)
  R.setPrivateNames(null); process.env.WARDOS_NAMES = "partner=Zedna;school=QXS";
  assert.equal(R.stripPrivate("Zedna and QXS"), "and QXS");
  delete process.env.WARDOS_NAMES; R.setPrivateNames(null);
  const p = join(TMP, ".config/wardos"); (await import("node:fs")).mkdirSync(p, { recursive: true });
  writeFileSync(join(p, "private-names.tsv"), "# stand-ins\nexternal\tQuill\nschool\tQXS\n", { mode: 0o600 });
  assert.equal(R.stripPrivate("Quill party"), "party");
  R.setPrivateNames(null);
} finally { rmSync(TMP, { recursive: true, force: true }); }
console.log("lh-names: ok");
