/* TEMPHOME1 · shared structural guard for every test that loads a private-list reader (school-names.js, private-dir.mjs,
   text_law.py, cal-months.py, livinghouse/lh-rules.js). Import it FIRST:   import { assertSealed } from "./temp-home.mjs";
   On import it unsets every WARDOS_* variable and points HOME at a fresh temp folder (child processes inherit both).
   assertSealed() throws when HOME is still the real one, or when a private names file is readable at any path the
   readers would try under the current environment. It never opens or prints a private file; it only checks paths. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REAL_HOME = process.env.HOME || os.homedir();
for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
/* LHVID1' (Alfred P2 0720) · python playwright lives in the REAL user site and its browsers in the real
   ~/.cache/ms-playwright. LHVID1'' (Alfred 0803 P4 seal): pass through ONLY the user site-packages folder as PYTHONPATH
   (never PYTHONUSERBASE, whose parent ~/.local also holds the private folder) plus the browsers path. Captured BEFORE the
   HOME swap; assertSealed() proves no reader path resolves under either one. */
/* tool discovery uses the account's passwd home, so it also works when the caller already runs under an outer temp HOME */
const PW_HOME = (() => { try { return os.userInfo().homedir || REAL_HOME; } catch { return REAL_HOME; } })();
function realPythonSite() {
  const r = spawnSync("python3", ["-m", "site", "--user-site"], { encoding: "utf8", env: { ...process.env, HOME: PW_HOME } });
  const v = r.status === 0 ? String(r.stdout).trim() : "";
  return v && path.isAbsolute(v) && /site-packages$/.test(v) && fs.existsSync(v) ? v : "";
}
const PY_SITE = realPythonSite();
const PW_BROWSERS = process.env.PLAYWRIGHT_BROWSERS_PATH || (fs.existsSync(path.join(PW_HOME, ".cache/ms-playwright")) ? path.join(PW_HOME, ".cache/ms-playwright") : "");
export const TEMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "wardos-temphome-"));
process.env.HOME = TEMP_HOME;
delete process.env.PYTHONUSERBASE;
if (PY_SITE) process.env.PYTHONPATH = PY_SITE;
if (PW_BROWSERS) process.env.PLAYWRIGHT_BROWSERS_PATH = PW_BROWSERS;
/** the tool folders that cross the HOME swap (for the seal checks) */
export function passThroughPaths() { return [process.env.PYTHONPATH, process.env.PYTHONUSERBASE, process.env.PLAYWRIGHT_BROWSERS_PATH].filter(Boolean).flatMap((v) => String(v).split(path.delimiter)).filter(Boolean); }
/** every private-list location under the REAL home (paths only, never opened) */
export const REAL_PRIVATE = [".local/share/wardos-private", ".local/share/wardos-private/private-names.tsv", ".config/wardos/private-names.tsv", ".config/wardos/privacy-denylist.txt", ".config/wardos"].flatMap((r) => [...new Set([REAL_HOME, PW_HOME])].map((h) => path.join(h, r)));
const under = (p, base) => { const a = path.resolve(p), b = path.resolve(base); return a === b || a.startsWith(b + path.sep); };

/* LHVID1' teardown · delete OUR temp HOME, by its exact path, on every exit (never a glob). */
let cleaned = false;
export function cleanupTempHome() {
  if (cleaned) return; cleaned = true;
  if (path.dirname(TEMP_HOME) === path.resolve(os.tmpdir()) && path.basename(TEMP_HOME).startsWith("wardos-temphome-"))
    try { fs.rmSync(TEMP_HOME, { recursive: true, force: true }); } catch { /* best effort */ }
}
process.on("exit", cleanupTempHome);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(sig, () => { cleanupTempHome(); process.exit(128 + (os.constants.signals[sig] || 0)); });
/* withTempHome(fn): run fn, always clean up afterwards (try/finally), for scripts that are not node --test files. */
export async function withTempHome(fn) { try { return await fn(TEMP_HOME); } finally { cleanupTempHome(); } }

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
  /* LHVID1'' seal: no reader or private-list path resolves under a passed-through tool folder, and the private folder is
     not reachable from the sealed HOME (the HOME-relative reader paths do not exist). Paths only; nothing is opened. */
  for (const t of passThroughPaths()) for (const p of [...readerPaths(), ...REAL_PRIVATE])
    if (under(p, t)) throw new Error("TEMPHOME1: a private-list path resolves under a passed-through tool path");
  for (const p of [path.join(H, ".local/share/wardos-private"), path.join(H, ".config/wardos"), ...readerPaths()]) {
    let real = ""; try { real = fs.realpathSync(p); } catch { continue; }   /* absent: fine (a test's synthetic file under the temp HOME is fine too) */
    if (REAL_PRIVATE.some((r) => under(real, r)) || !under(real, os.tmpdir()))
      throw new Error("TEMPHOME1: a private-list path is reachable from the sealed HOME");
  }
  return TEMP_HOME;
}
/* sealedRequire(require, spec): asserts the seal, then loads a private-list reader */
export function sealedRequire(req, spec) { assertSealed(); return req(spec); }
