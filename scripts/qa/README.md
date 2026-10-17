# House Face · QA gates

## Test suite: one command (QA1)
```bash
scripts/qa/run-tests.sh            # every scripts/qa/*.test.mjs, in parallel; fails on any failure OR any skip
scripts/qa/run-tests.sh --serial   # same, --test-concurrency=1
```
- Needs the `ws` module once: `npm install --no-save --prefix ~/.cache/wardos-deps ws@8` (override the folder with
  `WARDOS_DEPS=<dir>/node_modules`). Without it the script stops with that hint instead of letting the proxy tests skip.
- Each test isolates its own ports, temp HOME and private dir. The privacy-scan plant tests use
  `privacy-scan.mjs --only/--skip` so parallel files never see each other's planted files.
- The NOMONEY1 1920x1080 check drives a real browser (python playwright). `QA_NO_BROWSER=1` is the only allowed skip
  (CI without chromium).

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
- Contract: box-only `<private>/qa/cash.contract.json` (PRIVFEED1, never in git; refresh when Ledger restamps). CI uses `fixtures/cash.contract.synthetic.json`.
- Wright does not invent `$`. Cliff **PARK** (private, not in CI).
- When cash present: Wells AVAILABLE once · EOY SHORT · GATE OPEN · kill OFF · Guild statement once · as-of stamp.

## PARK
- Job C dead-end / asset / fake pack-strip — optional tonight; not in workflow.
- Glance LIVE tips (HUBGLANCE1 / TODAYGLANCE1 / DADGLANCE1) — skipped.
