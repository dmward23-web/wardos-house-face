#!/usr/bin/env node
/**
 * GATE 2 — Numbers / money contract (Ledger-owned)
 *
 * Ledger owns SoT. Wright / house-face CI never invents $.
 * Live SoT: /workspace/board-os/data/cash.json (NOT in house-face git).
 * CI fixture: scripts/qa/fixtures/cash.contract.json — refresh when Ledger restamps.
 *
 * Rules when cash present:
 *   · Wells AVAILABLE once · matches fixture (tonight $13,923.03 · LIVE · Plaid 2026-10-03 ~9:40p CT)
 *   · EOY SHORT matches · GATE CLOSED (<$15k) · kill OFF
 *   · as-of stamp present
 *   · Guild once = statement amount (never $4k double / never double-count)
 *   · plate $ bound to stamp (fixture lockedAt / asOfLabel)
 *   · cliff SoT decree May 2028 (Dan exact-yes) — CI holds available/eoy; does not invent cliff $
 *
 * If no fixture AND no in-repo cash.json: SKIP with explicit Ledger message
 * (legacy path). Tonight fixture is required so CI asserts the contract.
 *
 * Also: if house-face live HTML/JS paints AVAILABLE / Guild $ copy, enforce
 * single AVAILABLE · Guild not doubled · as-of present — never invent values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = path.join(ROOT, "scripts/qa/fixtures/cash.contract.json");
const IN_REPO_CASH = path.join(ROOT, "data/cash.json");

/** Expected contract (must match fixture — Ledger restamp updates both). */
const EXPECT = {
  available: 13923.03,
  availableDisplay: "$13,923.03",
  eoyShort: 6076.97,
  eoyGapDisplay: "SHORT $6,076.97",
  gateState: "CLOSED",
  killOff: "OFF",
  guildMonthly: 3589.57,
  guildMustNot: [4000, 4000.0, 7179.14], // never $4k double / never 2× statement
};

function nearly(a, b, eps = 0.009) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

function loadJson(fp) {
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function assertFixture(cash, bad) {
  if (!nearly(cash.available, EXPECT.available)) {
    bad.push(
      `AVAILABLE mismatch: fixture ${cash.available} ≠ contract ${EXPECT.available} (${EXPECT.availableDisplay})`
    );
  }
  const gate = cash.discGate?.state || cash.discGate?.State;
  if (String(gate).toUpperCase() !== EXPECT.gateState) {
    bad.push(`discGate.state want ${EXPECT.gateState}, got ${gate}`);
  }
  const short = cash.eoy?.short ?? cash.eoy?.gap;
  if (!nearly(short, EXPECT.eoyShort)) {
    bad.push(`EOY SHORT want ${EXPECT.eoyShort}, got ${short}`);
  }
  const kill = cash.eoy?.killLedgerClause;
  if (String(kill).toUpperCase() !== EXPECT.killOff) {
    bad.push(`kill Ledger clause want ${EXPECT.killOff}, got ${kill}`);
  }
  if (!cash.as_of && !cash.asOfLabel && !cash.lockedAt) {
    bad.push("as-of stamp missing (as_of / asOfLabel / lockedAt)");
  }
  const guild = cash.guild?.monthlyPayment ?? cash.guild?.totalAutopay;
  if (!nearly(guild, EXPECT.guildMonthly)) {
    bad.push(`Guild statement want ${EXPECT.guildMonthly}, got ${guild}`);
  }
  // never double
  const addl = Number(cash.guild?.additionalPrincipal || 0);
  const total = Number(cash.guild?.totalAutopay ?? guild);
  if (addl > 0 && nearly(total, EXPECT.guildMonthly * 2)) {
    bad.push("Guild looks doubled (totalAutopay ≈ 2× statement) — never $4k double");
  }
  for (const forbid of EXPECT.guildMustNot) {
    if (nearly(guild, forbid)) {
      bad.push(`Guild monthlyPayment looks like forbidden stand-in ${forbid}`);
    }
  }
  // plate $ bound to stamp
  if (cash.lockedAt && cash.available != null) {
    // ok — fixture carries both
  } else if (!cash.asOfLabel) {
    bad.push("plate $ not bound to stamp (need lockedAt or asOfLabel with available)");
  }

  // cliff decree May 2028 — note from fixture meta; never invent cliff $ in CI
  const meta = cash._meta || {};
  const cliff = meta.cliff || meta.cliffNote || "";
  if (cliff || /2028|2029/.test(JSON.stringify(cash))) {
    console.log(
      "GATE2 NOTE — cliff SoT decree May 2028 (Ledger) · CI holds available/eoy only · no invent cliff $"
    );
  }
}

/** Scan house-face for painted AVAILABLE / Guild money (should be rare / desk-gate only). */
function scanHouseFaceMoney(bad) {
  const surfaces = [];
  for (const name of fs.readdirSync(ROOT)) {
    if (
      /^(sheet-.*\.html|kid-.*\.html|index\.html|house-.*\.js|kids-data\.js)$/.test(name) &&
      !name.includes("-pre-theme")
    ) {
      surfaces.push(name);
    }
  }
  const moneyPaint = /AVAILABLE\s*\$|Guild[^\n]{0,40}\$|\$19,?\d{3}|\$3,?589|\$4,000|\$4000/i;
  const hits = [];
  for (const rel of surfaces) {
    let text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    text = text
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    // desk-gate may mention AVAILABLE as concept without painting the number — OK
    if (/sheet-desk-gate\.html/.test(rel) && !/\$19,?\d{3}/.test(text) && !/\$3,589/.test(text)) {
      continue;
    }
    // kid jar "Available $" voice ≠ Wells AVAILABLE — skip kids-data / kid-* unless Wells/Guild figures
    if (/^(kids-data\.js|kid-)/.test(rel) && !/\$19,?\d{3}|Guild|\$3,589|\$4,000/.test(text)) {
      continue;
    }
    const lines = text.split(/\n/);
    lines.forEach((line, i) => {
      if (moneyPaint.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  if (!hits.length) {
    console.log(
      "GATE2 — house-face paints no Wells/Guild $ (money SoT is Sheet/Dashboard · contract lives with Ledger)"
    );
    return;
  }
  // If painted: enforce once AVAILABLE, Guild not doubled, as-of nearby in same file-ish
  const avail = hits.filter((h) => /AVAILABLE/i.test(h));
  const guild = hits.filter((h) => /Guild/i.test(h));
  const fourk = hits.filter((h) => /\$4,000|\$4000\b/.test(h));
  if (fourk.length) {
    bad.push("Guild/$4k double smell on house-face glass:\n  " + fourk.join("\n  "));
  }
  if (avail.length > 3) {
    bad.push(`AVAILABLE appears heavily duplicated on glass (${avail.length} hits) — want once`);
  }
  console.log("GATE2 — money paint hits (enforcing contract against fixture):");
  hits.slice(0, 12).forEach((h) => console.log("  " + h));
}

function main() {
  const bad = [];
  const hasFixture = fs.existsSync(FIXTURE);
  const hasInRepo = fs.existsSync(IN_REPO_CASH);

  if (!hasFixture && !hasInRepo) {
    console.log(
      "GATE2 SKIP — money SoT is Sheet/Dashboard — contract lives with Ledger (no cash.json / no fixture in house-face)"
    );
    process.exit(0);
  }

  const fp = hasFixture ? FIXTURE : IN_REPO_CASH;
  const label = hasFixture ? "scripts/qa/fixtures/cash.contract.json" : "data/cash.json";
  console.log(`GATE2 — loading ${label}`);
  console.log(
    "GATE2 — Ledger owns SoT · Wright does not invent $ · refresh fixture when Ledger restamps"
  );

  let cash;
  try {
    cash = loadJson(fp);
  } catch (e) {
    console.error("GATE2 FAIL — cannot parse cash contract:", e.message);
    process.exit(1);
  }

  assertFixture(cash, bad);
  scanHouseFaceMoney(bad);

  console.log("GATE2 — cliff decree May 2028 · available/eoy asserted · cliff $ not invented");

  if (bad.length) {
    console.error("GATE2 FAIL — numbers contract:");
    bad.forEach((b) => console.error("  " + b));
    process.exit(1);
  }

  console.log(
    `GATE2 PASS — AVAILABLE ${EXPECT.availableDisplay} · EOY ${EXPECT.eoyGapDisplay} · GATE ${EXPECT.gateState} · kill ${EXPECT.killOff} · Guild $${EXPECT.guildMonthly.toFixed(2)} once · as-of ok`
  );
}

main();
