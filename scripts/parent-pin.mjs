#!/usr/bin/env node
/* NICEONE1 · scripts/parent-pin.mjs · set / check / clear the hub's parent PIN for the wall's "Nice one" (Wright).
   Run ON THE HUB, in a terminal. The PIN is typed twice at a hidden prompt (no echo), must be 4 digits, and is stored as a
   salted scrypt hash in ~/.config/wardos/parent-pin.json (mode 600). Never in git, never sent to a browser.
   --help / -h prints usage and writes nothing. Unknown commands/flags exit 2 and write nothing. */
import { createPinStore, configDir, PIN_RE } from "./house/parent-pin-store.mjs";

const USAGE = `Usage: node scripts/parent-pin.mjs <set|status|clear> [--help]
  set     ask for a 4-digit PIN twice (hidden, terminal only) and store its salted scrypt hash
  status  say whether a PIN is set (and whether 5 wrong tries have it locked)
  clear   remove the PIN (and any lock); the wall's Nice one goes back to hidden
  File: ~/.config/wardos/parent-pin.json (mode 600). --help prints this and writes nothing.`;

function hiddenAsk(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    let buf = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const done = (err, val) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", on); stdout.write("\n"); err ? reject(err) : resolve(val); };
    const on = (s) => {
      for (const ch of s) {
        if (ch === "\u0003") return done(new Error("cancelled"));          /* Ctrl-C */
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return done(null, buf);
        if (ch === "\u007f" || ch === "\b") { buf = buf.slice(0, -1); continue; }
        if (buf.length < 16) buf += ch;                                     /* nothing is echoed */
      }
    };
    stdin.on("data", on);
  });
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { process.stdout.write(USAGE + "\n"); return 0; }
  const cmd = args[0];
  if (args.length !== 1 || !["set", "status", "clear"].includes(cmd)) { process.stderr.write(`unknown or missing command: ${args.join(" ") || "(none)"}\n${USAGE}\n`); return 2; }
  const store = createPinStore({ dir: configDir() });
  if (cmd === "status") {
    const l = store.lockState();
    process.stdout.write(`parent PIN: ${store.isSet() ? "set" : "not set"}${l.locked ? ` · locked for ${Math.ceil(l.retryAfterMs / 60000)} more min (5 wrong tries)` : ""}\n  file: ${store.paths.pin}\n`);
    return 0;
  }
  if (cmd === "clear") { const had = store.clear(); process.stdout.write(had ? "parent PIN cleared. Nice one is hidden again.\n" : "no parent PIN was set.\n"); return 0; }
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") { process.stderr.write("set needs a terminal (hidden prompt). Nothing written.\n"); return 2; }
  let a;
  try { a = await hiddenAsk("New 4-digit parent PIN: "); } catch { process.stderr.write("cancelled. Nothing written.\n"); return 1; }
  if (!PIN_RE.test(a)) { process.stderr.write("PIN must be exactly 4 digits. Nothing written.\n"); return 1; }
  let b;
  try { b = await hiddenAsk("Same PIN again: "); } catch { process.stderr.write("cancelled. Nothing written.\n"); return 1; }
  if (a !== b) { process.stderr.write("PINs didn't match. Nothing written.\n"); return 1; }
  store.set(a);
  process.stdout.write(`parent PIN set (salted scrypt hash, mode 600): ${store.paths.pin}\nRestart lights-write-proxy if it isn't running the NICEONE1 build yet.\n`);
  return 0;
}
main(process.argv).then((c) => process.exit(c), (e) => { process.stderr.write(String(e && e.message || e) + "\n"); process.exit(1); });
