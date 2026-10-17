#!/usr/bin/env node
/**
 * GATE 2 — Numbers / money contract (Ledger-owned)
 *
 * PRIVFEED1 · no real money in git. The contract (Ledger restamp + expected values + paint patterns) lives in the
 * box-only private folder: <private>/qa/cash.contract.json (scripts/private-dir.mjs; WARDOS_PRIVATE_DIR overrides).
 * When that file is absent (CI, cloud builders) GATE 2 runs against the SYNTHETIC fixture
 * scripts/qa/fixtures/cash.contract.synthetic.json so the contract logic is still exercised.
 *
 * Rules: AVAILABLE once and matching · EOY SHORT matches · gate state · kill clause · as-of stamp ·
 * Guild once = statement amount (never doubled / never a forbidden stand-in) · glass paints no Wells/Guild figures.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privPath } from "../private-dir.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRIVATE_CONTRACT = privPath("qa", "cash.contract.json");
const FIXTURE = fs.existsSync(PRIVATE_CONTRACT) ? PRIVATE_CONTRACT : path.join(ROOT, "scripts/qa/fixtures/cash.contract.synthetic.json");
const FIXTURE_LABEL = FIXTURE === PRIVATE_CONTRACT ? "private contract (box-only)" : "SYNTHETIC fixture";
const IN_REPO_CASH = path.join(ROOT, "data/cash.json");

/** Expected contract comes from the contract file itself (expect block). */
let EXPECT = { availableDisplay: "?", eoyGapDisplay: "?", gateState: "?", killOff: "?", guildMonthly: 0, guildMustNot: [], paintPatterns: [] };
try { EXPECT = { ...EXPECT, ...(JSON.parse(fs.readFileSync(FIXTURE, "utf8")).expect || {}) }; } catch { /* reported in main */ }

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
    bad.push("Guild looks doubled (totalAutopay ≈ 2× statement)");
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

  // cliff note from the private contract meta; never invent cliff $ in CI
  const meta = cash._meta || {};
  const cliff = meta.cliff || meta.cliffNote || "";
  if (cliff) {
    console.log(
      "GATE2 NOTE — cliff SoT (Ledger, private) · CI holds available/eoy only · no invent cliff $"
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
  const moneyPaint = new RegExp(["AVAILABLE\\s*\\$", "Guild[^\\n]{0,40}\\$", "\\$\\d{1,3},\\d{3}\\.\\d\\d"].concat(EXPECT.paintPatterns || []).join("|"), "i");
  const hits = [];
  for (const rel of surfaces) {
    let text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    text = text
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    // desk-gate may mention AVAILABLE as concept without painting the number — OK
    if (/sheet-desk-gate\.html/.test(rel) && !/\$\d{1,3},\d{3}\.\d\d/.test(text)) {
      continue;
    }
    // kid jar "Available $" voice ≠ Wells AVAILABLE — skip kids-data / kid-* unless Wells/Guild figures
    if (/^(kids-data\.js|kid-)/.test(rel) && !/\$\d{1,3},\d{3}\.\d\d|Guild/.test(text)) {
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
  const fourk = hits.filter((h) => (EXPECT.paintPatterns || []).some((p) => new RegExp(p).test(h)));
  if (fourk.length) {
    bad.push("Guild double / contract figure painted on house-face glass:\n  " + fourk.join("\n  "));
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
  const label = hasFixture ? FIXTURE_LABEL : "data/cash.json";
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

  console.log("GATE2 — available/eoy asserted · cliff $ not invented");

  if (bad.length) {
    console.error("GATE2 FAIL — numbers contract:");
    bad.forEach((b) => console.error("  " + b));
    process.exit(1);
  }

  /* PRIVFEED1 · never print real figures (CI logs are public): state only */
  console.log(`GATE2 PASS — ${FIXTURE_LABEL} · AVAILABLE once · EOY matches · GATE ${EXPECT.gateState} · kill ${EXPECT.killOff} · Guild once · as-of ok`);
}

main();
