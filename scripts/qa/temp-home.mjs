/* TEMPHOME1 · shared structural guard for every test that loads a private-list reader (school-names.js, private-dir.mjs,
   text_law.py, cal-months.py, livinghouse/lh-rules.js). Import it FIRST:   import { assertSealed } from "./temp-home.mjs";
   On import it unsets every WARDOS_* variable and points HOME at a fresh temp folder (child processes inherit both).
   assertSealed() throws when HOME is still the real one, or when a private names file is readable at any path the
   readers would try under the current environment. It never opens or prints a private file; it only checks paths. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REAL_HOME = process.env.HOME || os.homedir();
for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
export const TEMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "wardos-temphome-"));
process.env.HOME = TEMP_HOME;

const REL = [".local/share/wardos-private/private-names.tsv", ".config/wardos/private-names.tsv"];
export function readerPaths() {
  const H = os.homedir(), e = process.env, out = REL.map((r) => path.join(H, r));
  if (e.WARDOS_PRIVATE_NAMES) out.push(e.WARDOS_PRIVATE_NAMES);
  if (e.WARDOS_PRIVATE_DIR) out.push(path.join(e.WARDOS_PRIVATE_DIR, "private-names.tsv"));
  return out;
}
export function assertSealed(allow = []) {
  const H = os.homedir();
  if (!H || H === REAL_HOME || path.resolve(H) === path.resolve(REAL_HOME)) throw new Error("TEMPHOME1: HOME is the real home; import scripts/qa/temp-home.mjs first");
  if (!path.resolve(H).startsWith(path.resolve(os.tmpdir()))) throw new Error("TEMPHOME1: HOME is not a temp folder");
  for (const p of readerPaths()) {
    if (allow.includes(p)) continue;   /* a test's own synthetic file, written under the temp folder */
    if (!path.resolve(p).startsWith(path.resolve(os.tmpdir()))) throw new Error("TEMPHOME1: a reader path points outside the temp folder");
  }
  return TEMP_HOME;
}
/* sealedRequire(require, spec): asserts the seal, then loads a private-list reader */
export function sealedRequire(req, spec) { assertSealed(); return req(spec); }
