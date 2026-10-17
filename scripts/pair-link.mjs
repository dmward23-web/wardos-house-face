#!/usr/bin/env node
/* PRIVFEED3 · mint a one-time pairing link on the box (for Atlas to send Dan as a tap; nothing to paste).
 *   node scripts/pair-link.mjs [--house https://…/sheet-index.html]
 * Asks the running lights proxy (127.0.0.1:8788) for a code with the device key read from
 * ~/.config/wardos/lights-proxy.token (sent as a header, never argv). Prints ONE line: the link
 * <house>#pair=<code> (no hub in the link). The code works once, for 5 minutes. The fragment never reaches a server log.
 * The device key itself is never printed. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CFG = path.join(os.homedir(), ".config", "wardos");
const read = (f) => { try { return fs.readFileSync(path.join(CFG, f), "utf8").trim(); } catch { return ""; } };
const i = process.argv.indexOf("--house");
/* HUBPIN1 · the link opens the house host (camera proxy, which serves the pages); the screen finds the hub itself.
   No &hub= : a host in a link is never trusted. */
const camHost = read("nest-webrtc-proxy.url").replace(/\/$/, "");
const house = (i > 0 && process.argv[i + 1]) || read("house-url") || (camHost ? camHost + "/sheet-index.html" : "");
const key = read("lights-proxy.token");
if (!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?\//.test(house)) { console.error("pair-link: house address missing (~/.config/wardos/nest-webrtc-proxy.url or --house)"); process.exit(2); }
if (key.length < 16) { console.error("pair-link: device key missing"); process.exit(2); }
const r = await fetch("http://127.0.0.1:8788/api/pair/mint", { method: "POST", headers: { "X-Lights-Proxy-Token": key, "Content-Type": "application/json" }, body: "{}" }).catch((e) => ({ ok: false, status: 0, e }));
if (!r.ok) { console.error("pair-link: lights proxy did not mint a code (HTTP " + r.status + "). Is it running from the pinned tree?"); process.exit(1); }
const j = await r.json();
console.log(house + "#pair=" + encodeURIComponent(j.code));
console.error("pair-link: send ONLY in Atlas's direct chat to Dan, after his yes. He taps the link, then taps Pair this screen. Works once, expires " + new Date(j.expiresAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago" }) + " CT");
