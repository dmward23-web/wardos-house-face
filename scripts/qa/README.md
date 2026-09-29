# House Face · QA gates

Two CI gates on `push`/`pull_request` to `main` (workflow: `.github/workflows/house-face-qa.yml`).

## GATE 1 — placeholder lint
`node scripts/qa/gate1-placeholder-lint.mjs`

Fails live wall HTML/JS/JSON with user-visible `EXAMPLE`, `DEMO` (grocery/dinner fake tags), `lorem`, live `TODO`, `NEED PHOTO`, `—°`, or hub/sheet header date ≠ today `America/Chicago`.

Prove SHEETCLK2-era groceries would RED:
```bash
node scripts/qa/gate1-placeholder-lint.mjs --file scripts/qa/fixtures/sheet-groceries.SHEETCLK2.html
```

## GATE 2 — numbers contract (Ledger-owned)
`node scripts/qa/gate2-numbers-contract.mjs`

- Live SoT: `/workspace/board-os/data/cash.json` (NOT in house-face git).
- CI fixture: `fixtures/cash.contract.json` — copy/normalize from Ledger; **refresh when Ledger restamps**.
- Wright does not invent `$`. Cliff 2028/2029 **PARK** (not fixed in CI).
- When cash present: Wells AVAILABLE once · EOY SHORT · GATE OPEN · kill OFF · Guild statement once (never $4k double) · as-of stamp.

## PARK
- Job C dead-end / asset / fake pack-strip — optional tonight; not in workflow.
- Glance LIVE tips (HUBGLANCE1 / TODAYGLANCE1 / DADGLANCE1) — skipped.
