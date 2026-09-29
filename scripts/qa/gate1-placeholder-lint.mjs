#!/usr/bin/env node
/**
 * GATE 1 — Placeholder lint (house-face live wall surfaces)
 * Fail if shipped hub/dad/kids/sheet HTML/JS/JSON carries user-visible:
 *   EXAMPLE, DEMO (grocery/dinner fake tags), lorem, TODO live, NEED PHOTO,
 *   em-dash degree —°, or hub/sheet header date ≠ today America/Chicago.
 * Skips comments. Skips plates/, mocks, LOOK.md, RECEIPT*, node_modules, .git,
 * *-pre-theme.html. Photo Index NEED PHOTO optional (skip sheet-gallery*).
 *
 * Usage:
 *   node scripts/qa/gate1-placeholder-lint.mjs
 *   node scripts/qa/gate1-placeholder-lint.mjs --file scripts/qa/fixtures/sheet-groceries.SHEETCLK2.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TZ = "America/Chicago";

const SKIP_DIR_RE = /(^|\/)(plates|plates-receipt|mocks|node_modules|\.git|phone-shots)(\/|$)/i;
const SKIP_NAME_RE = /(-pre-theme\.html$|LOOK\.md$|RECEIPT|^\.)/i;
const GALLERY_OPTIONAL_RE = /^sheet-gallery(-hero)?\.html$/i;

/** Words / tokens that must not ship as user-visible copy. */
const BAN_RE = /\bEXAMPLE\b|\bDEMO\b|\blorem\b|\bTODO\b|NEED PHOTO|—°/gi;

/** Anti-placeholder messaging is OK (KITDEAD / lights pad). */
const ANTI_RE =
  /\b(?:never|no|not)\s+DEMO\b|\bnever\s+EXAMPLE\b|\bno\s+fake\b.*\bDEMO\b|\bEmpty LIVE jar\b.*\bDEMO\b/i;

/** Live hosts that JS paints (weather/sensi empty shell before clock fill). */
const LIVE_DEGREE_HOST_RE =
  /oval-deg|sensi-hero-set|data-live|id=["'][^"']*(?:sensi|wx|weather|temp)/i;

/** Machine / code identifiers — not grocery DEMO tags. */
const CODEY_DEMO_RE =
  /\bis-demo-write\b|\bloadDemo\b|\bsaveDemo\b|\bdemo\.(ambient|setpoint|mode|fan|hold)\b|\bvar\s+demo\b|\bsource:\s*["']demo["']|\bstatus\s*===\s*["']need_token["']/i;

function todayParts(d = new Date()) {
  const shortComma = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d); // "Mon, Sep 28"
  const short = shortComma.replace(",", ""); // "Mon Sep 28"
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // 2026-09-28
  const dayNum = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    day: "numeric",
  }).format(d);
  const monShort = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
  }).format(d);
  const dow = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(d);
  // also "Mon 28 Sep" style (Ledger as-of)
  const alt = `${dow} ${dayNum} ${monShort}`;
  return { short, shortComma, iso, alt, dow, monShort, dayNum };
}

function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function listLiveFiles() {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name);
      const rel = path.relative(ROOT, fp);
      if (SKIP_DIR_RE.test(rel)) continue;
      if (ent.isDirectory()) {
        walk(fp);
        continue;
      }
      if (SKIP_NAME_RE.test(ent.name)) continue;
      if (GALLERY_OPTIONAL_RE.test(ent.name)) continue; // Photo Index optional tonight
      const ok =
        /^(sheet-.*\.html|kid-.*\.html|index\.html|house-.*\.js|kids-data\.js|kids-week\.json)$/.test(
          ent.name
        ) ||
        (rel.startsWith("data" + path.sep) &&
          /\.(json)$/.test(ent.name) &&
          !/cash\.json$/i.test(ent.name));
      // live root surfaces only (not nested junk)
      if (
        (ent.name.startsWith("sheet-") && ent.name.endsWith(".html")) ||
        (ent.name.startsWith("kid-") && ent.name.endsWith(".html") && !ent.name.includes("-pre-theme")) ||
        ent.name === "index.html" ||
        /^house-[a-z0-9-]+\.js$/i.test(ent.name) ||
        ent.name === "kids-data.js" ||
        ent.name === "kids-week.json"
      ) {
        if (path.dirname(rel) === ".") out.push(rel);
      }
    }
  };
  walk(ROOT);
  return out.sort();
}

function isAllowedHit(line, file) {
  if (ANTI_RE.test(line)) return true;
  if (CODEY_DEMO_RE.test(line)) return true;
  // class/id tokens like is-demo-write already covered; bare identifier demo. in JS
  if (/\.js$/i.test(file)) {
    // string literal with DEMO/EXAMPLE = not allowed unless anti
    const strHits = [...line.matchAll(/["'`]([^"'`]*?)["'`]/g)].map((m) => m[1]);
    const bannedInString = strHits.some((s) =>
      /\bEXAMPLE\b|\bDEMO\b|\blorem\b|\bTODO\b|NEED PHOTO|—°/i.test(s)
    );
    if (!bannedInString) {
      // identifier-only DEMO/demo → allow
      if (/\bdemo\b/i.test(line) && !/\bEXAMPLE\b|\blorem\b|\bTODO\b|NEED PHOTO|—°/i.test(line)) {
        return true;
      }
    } else {
      // string has banned word — still allow anti phrases inside string
      if (strHits.some((s) => ANTI_RE.test(s))) return true;
    }
  }
  // —° inside live degree hosts (JS-filled)
  if (/—°/.test(line) && LIVE_DEGREE_HOST_RE.test(line)) return true;
  return false;
}

/** Header chrome date: cheer-label / cheer-title starting with weekday date / hdr-date without data-live */
const DATE_IN_LINE = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:,)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;

function normalizeDateToken(s) {
  return s.replace(/,/g, "").replace(/\s+/g, " ").trim();
}

function dateEqualsToday(token, today) {
  const n = normalizeDateToken(token);
  const candidates = [today.short, today.shortComma, today.alt].map(normalizeDateToken);
  return candidates.some((c) => c.toLowerCase() === n.toLowerCase());
}

function checkHeaderDates(rel, text, today, bad) {
  const lines = text.split(/\n/);
  lines.forEach((line, i) => {
    if (!DATE_IN_LINE.test(line)) return;
    if (/\bdata-live\b/.test(line)) return; // JS-live clock — don't false-fail
    // header chrome only
    const chrome =
      /\bhdr-date\b|\bcheer-label\b|\bcheer-title\b|\blive-clock-host\b|\bdate-badge\b/.test(line) ||
      (/cheer-title/.test(line) && /^\s*<div class="cheer-title">\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(line));
    if (!chrome) return;
    // cheer-title that starts with a date (today stamp) vs event date mid-line
    if (/\bcheer-title\b/.test(line)) {
      const m = line.match(
        /cheer-title[^>]*>\s*(?:<span[^>]*>)?\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:,)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})/i
      );
      if (!m) return; // e.g. "Hayes birthday · Fri Sep 25" — event, not today chrome
      if (!dateEqualsToday(m[1], today)) {
        bad.push(`${rel}:${i + 1}: header date ≠ today CT (${today.short}): ${line.trim().slice(0, 120)}`);
      }
      return;
    }
    if (/\bcheer-label\b/.test(line)) {
      // "Known · Fri Sep 25" = historical context stamp, not "today is Fri"
      if (/\bKnown\b/i.test(line)) return;
      const m = line.match(DATE_IN_LINE);
      if (m && !dateEqualsToday(m[0], today)) {
        bad.push(`${rel}:${i + 1}: header date ≠ today CT (${today.short}): ${line.trim().slice(0, 120)}`);
      }
    }
    if (/\bhdr-date\b/.test(line)) {
      const m = line.match(DATE_IN_LINE);
      if (m && !dateEqualsToday(m[0], today)) {
        bad.push(`${rel}:${i + 1}: header date ≠ today CT (${today.short}): ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

function scanFile(rel, abs, today, bad) {
  const raw = fs.readFileSync(abs, "utf8");
  const text = stripComments(raw);
  const lines = text.split(/\n/);
  lines.forEach((line, i) => {
    BAN_RE.lastIndex = 0;
    if (!BAN_RE.test(line)) return;
    if (isAllowedHit(line, rel)) return;
    bad.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
  });
  if (/\.html$/i.test(rel)) checkHeaderDates(rel, text, today, bad);
}

function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const today = todayParts();
  const bad = [];

  if (fileIdx >= 0) {
    const target = args[fileIdx + 1];
    if (!target) {
      console.error("GATE1 FAIL — --file needs a path");
      process.exit(2);
    }
    const abs = path.isAbsolute(target) ? target : path.join(ROOT, target);
    const rel = path.relative(ROOT, abs);
    if (!fs.existsSync(abs)) {
      console.error("GATE1 FAIL — missing file", rel);
      process.exit(2);
    }
    scanFile(rel, abs, today, bad);
    if (bad.length) {
      console.error("GATE1 FAIL — placeholder/date lint:");
      bad.forEach((b) => console.error("  " + b));
      console.error(`(today CT = ${today.short} / ${today.iso})`);
      process.exit(1);
    }
    console.log(`GATE1 PASS — ${rel} clean (today CT ${today.short})`);
    return;
  }

  const files = listLiveFiles();
  for (const rel of files) {
    scanFile(rel, path.join(ROOT, rel), today, bad);
  }

  if (bad.length) {
    console.error("GATE1 FAIL — placeholder/date lint on live surfaces:");
    bad.forEach((b) => console.error("  " + b));
    console.error(`(today CT = ${today.short} / ${today.iso} · scanned ${files.length} files)`);
    process.exit(1);
  }
  console.log(`GATE1 PASS — placeholder lint clean · ${files.length} files · today CT ${today.short}`);
}

main();
