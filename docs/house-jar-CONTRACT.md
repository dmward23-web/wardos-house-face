# House JAR · CONTRACT (Ledger owns the data and the rule; Wright renders the tile)

**Law:** CHORE LAW, locked by Dan on Thu Oct 1 2026 at 8:01 PM CT (`plates/2026-10-01/redesign/CHORE-LAW-2026-10-01.md`).
- There is a family jar plus a personal jar for each kid. The jar pays **time and picks, never cash**.
- A stolen close zeros that kid's personal jar for the day.
- The rule is shown on the tile, and balances are not listed.
- This supersedes the 7:54 PM weekly money total and the cash "Nice one" bonus. That book was removed from this branch in commit `3dae8a6` (never pushed).
- Ainsley's babysitting hourly tag is a job rate, not the jar. It is not touched and not folded in here.

**NOT LIVE.** This is not called live until Alfred's QAQC PASS (the existing ship gate) and Dan's last-yes. It lives on branch `wall-redesign-ledger` only. It is not wired into any page or deployed, and the hub endpoint is unchanged.

## Files
| Path | What it is |
|---|---|
| `data/house-jar.json` | Seed, written only by Ledger. It holds the jars, `ruleText`, units, chips, reasons, limits, the undo window and `entries: []`. |
| `house-jar.js` | UMD module, `window.HouseJar` (Node: `require`). No dependencies, no timers. The only network calls are `load()` and the flag-gated `pushShared()`. |
| `scripts/wall/house-jar.test.mjs` | `node --test scripts/wall/house-jar.test.mjs` (14 tests). |

None of these files contains a currency glyph. A test enforces that.

## Units
- `min` is time: minutes of a privilege a parent hands out.
- `pick` is a count of choices, such as picking Sunday dinner or the movie.
- There is no cash unit. An entry with any other unit is refused.

## Entry shape (append-only)
```json
{ "id": "n-hayes-1790000000000-k3x9", "jar": "family|harris|hayes|ainsley",
  "type": "add|redeem|zero-day|reversal", "unit": "min|pick", "qty": 10,
  "reason": "Great attitude", "at": "2026-10-01T20:00:00-05:00", "dayKey": "2026-10-01", "refId": "<reversals only>" }
```
- `qty` is a whole number.
  - A Nice one add must equal a chip.
  - Any add is capped by `limits`: 120 min or 3 picks per entry.
  - A zero-day carries `qty: 0`.
- `dayKey` is the America/Chicago calendar date of `at`. It is computed with `Intl`, so it is DST-safe.
- Ids:
  - `n-<jar>-<epochms>-<rand4>`: Nice one, made on the device.
  - `c-<jar>-<sourceId>`: Atlas close credit. Deterministic, so the same close seen on two screens gives one entry.
  - `d-<jar>-<epochms>-<rand4>`: redeem.
  - `z-<kid>-<dayKey>`: zero-day. Exactly one per kid per day.
  - `r-<refId>`: reversal.
- Applying an id that is already in the book is a no-op. **Sync and merge are a union by id**, so a resync can never pay twice.
- **Nothing is ever deleted.** Undo and disputes append a `reversal`.

## Derived totals and the reset / zero rule (Atlas: please confirm)
For each jar and unit:
```
available = max(0, sum(qty of live adds whose dayKey is NOT zeroed for that jar) - sum(qty of live redeems))
```
- **Live** means the entry has no `r-<id>` reversal.
- **Persistence:** the family jar and the personal jars carry across days and weeks. There is **no weekly wipe**, because the law and the repo set no jar reset. The law's Repair rule ("doesn't carry into next week") is about missed MUSTS, not the jar.
- **zero-day `{kid, dayKey}`:**
  - That kid's personal-jar **adds dated that dayKey count 0**, for both minutes and picks. That day's adds are voided.
  - Earlier and later days, other kids, and the family jar are untouched.
  - **Redeems made that day still count**: time already spent stays spent. The floor keeps the total at or above 0.
  - The result does not depend on the order in which entries arrive, because it is computed from the set and not replayed in sequence.
  - A zero-day can only be recorded on a personal jar.
  - The reasons are fixed: "Closed a job that isn't theirs" and "Took a sibling's claimed choice".
  - A disputed close is handled with a parent `reverse(z-id)`, which restores the day.
- **Redeem** is refused if `qty` is more than `available`, so it can't go below 0. If a zero-day arrives after a spend, `available` clamps at 0 and never goes negative.
- Totals are never stored. There is no bank key and no balance field.

## API (`HouseJar`)
| Call | Gate | Returns |
|---|---|---|
| `load({fetch?, storage?, now?, parentGate?, url?})` / `create({seed, storage, now, parentGate, fetch, hubBase})` | | the book |
| `book.niceOne({jar, chip, reason, pinOk})` | parent | `{ok, entry}`, or an error: `parent-gate`, `bad-jar`, `not-a-chip`, `not-a-reason`. It adds time or picks from a fixed chip with a fixed reason. Never cash. |
| `book.credit({jar, unit, qty, sourceId, reason, at?})` | none (Atlas automation, not a wall button) | `{ok, entry\|noop}`. The reason must be in `creditReasons` ("Close done"). **No earning rate is seeded.** How much a close pays is for Atlas and Dan to set. |
| `book.zeroDay({kid, reason, dayKey? \| at?})` | none (Atlas claim-board detection) | `{ok, entry\|noop}` |
| `book.redeem({jar, unit, qty, reason, pinOk})` | parent | `{ok, entry}`, or `not-enough`, `not-a-reason`, `parent-gate`. Reasons: "Time used", "Picked Sunday dinner", "Picked the movie". |
| `book.reverse(refId, {pinOk})` | parent | Appends `r-<refId>`. For a Nice one, this only works within **10 minutes** of the original. For a zero-day (disputed close), a credit or a redeem, it works any time. |
| `book.wallDisplay()` | | **The only thing the tile renders:** `{ruleText, jars:[{jar, name}], synced, syncLabel}` |
| `book.parentView({pinOk})` | parent | `{ok, jars:[{jar, name, min, pick}]}`. This is for the internal or parent redeem screen only, **never the wall**. |
| `book.apply(e)` / `book.merge(es)` / `book.entries()` / `book.pending()` / `book.chips()` / `book.reasons()` / `book.syncState()` / `book.pushShared()` | | |
| `HouseJar.dayKeyFor(ms)`, `HouseJar.ctIso(ms)` | | |

## Wall display contract
- The tile prints `ruleText` verbatim: "The jar pays time and picks. Never cash. Close a job that isn't yours, or take a sibling's claimed choice, and your jar pays nothing that day."
- It shows the jar names.
- It shows `syncLabel` while `synced === false`.
- **The wall API exports no numbers.** There are no balances, counts or fill state (empty, some, full). The law says balances are not listed, so the tile has nothing to compare between kids.
- A test walks `wallDisplay()` and fails on any number value, any digit in a string, or any currency glyph.

## Chips and reasons (fixed, from the seed)
- `niceOneChips`: **+10 min** (`min-10`), **+15 min** (`min-15`), **+1 pick** (`pick-1`).
- `niceOneReasons`: Kind to a sibling, Helped without asking, Great attitude, Extra effort, Good listener.
- `redeemReasons`: Time used, Picked Sunday dinner, Picked the movie.
- `zeroDayReasons`: Closed a job that isn't theirs, Took a sibling's claimed choice.
- `creditReasons`: Close done.
- There is no free text and no free quantity. An off-chip Nice one that arrives by sync is refused.

## Parent gate
- No parent PIN or long-press exists in the repo, either on `main` or on Wright's `wall-redesign-1`. `scripts/parent-pin.mjs` is named in BRIEF.md but has not been built.
- The book requires `pinOk === true` (the boolean only). If `create({parentGate})` is supplied, `parentGate({action, jar})` must also return `true`. The actions are `nice-one`, `redeem`, `reverse` and `view`.
- **Wright supplies the gate:** the planned 1.5 s hold, then a PIN pad verified on the hub with a 5-try lockout. `pinOk = true` comes only from the hub's verify response. The PIN never reaches this module.

## Shared write: DESIGNED, OFF (LAST-YES, Dan)
- The module has `SHARED_WRITE_ENABLED = false`.
- **Until the key is on, this is NOT one shared truth.** Each screen sees the Ledger seed (`entries: []`) plus its own pending entries. The wall shows "Not synced" and never pretends otherwise.
- **Local queue:** localStorage key **`wardos.jar.pending.v1`**, value `{v:1, entries:[...]}`. It survives reload. `pushShared()` makes no request.
- **Proposed hub key:** **`house.jar.shared.v1`** on the existing hub tap endpoint `/api/taps`. The endpoint is not modified here; today its allow-list accepts only `house-checkoffs:` keys.
  - POST `{ changes: [ { key: "house.jar.shared.v1", id, entry } ] }`.
  - The server would validate the entry against the rules above, then **append it, deduped by id**. An existing id is ignored. There is no last-writer-wins and no delete.
  - The response is `{ ok, jar: [all entries], jarIds: [acked ids] }`.
  - Nice one, redeem and reverse should require a server-side PIN session.
  - The client unions `jar` into its book and drops the acked ids from pending.

## Baseline P0s fixed by this design
These are read-only findings. Line numbers are identical on `main` and on Wright's `ba2b4c4` unless noted.

1. **Per-device jar bank:** `kids-data.js:23` (`BANK_KEY = "house-bank:v1"`), read and written at `kids-data.js:370-376`. Tap sync shares only `house-checkoffs:` keys (`house-tapsync.js:6`; hub `scripts/lights-write-proxy.mjs:108`, or `:109` on `ba2b4c4`). **Fix:** there is no bank. Every total is derived from one entry book, and it becomes a single shared book once `house.jar.shared.v1` is on.
2. **All-or-nothing payout** (Ainsley's jar showed zero of twenty): `kids-data.js:412-413` (`weekEarnDollars` returns 0 unless every must is done) and `kids-data.js:482-484` (`getBankView` zeroes the week earn when the gate is not complete). **Fix:** the jar is a plain sum of what was added. The only zeroing is the law's explicit zero-day, and it applies to one kid for one day.
3. **Resync double-pay:** every device credits its own bank:
   - `kids-data.js:271-272` adds to lifetime when the gate opens.
   - `kids-data.js:449` settles prior weeks into the balance.
   - `kids-data.js:835` adds the week to the balance on payday.
   - `kids-data.js:859` stores a per-device paid stamp.

   So taps synced from another screen get credited again, and a payout on one screen is invisible on the others. **Fix:** ids are deterministic or unique, and merge is a union by id. Tests merge two overlapping devices twice in both directions and get no double count.
4. **Hub tap endpoint allow-list:** `/api/taps` at `scripts/lights-write-proxy.mjs:402` (`:403` on `ba2b4c4`). `TAP_KEY_RE` at `:108` (`:109`) allows only `house-checkoffs:{kid}:...`. **Fix (designed, off):** a new allowed key `house.jar.shared.v1` with append-only, dedupe-by-id semantics. The endpoint is not changed until Dan's last-yes.

## Risks
- **Not shared until Dan's last-yes on the hub key.** Each screen has its own pending book. A zero-day recorded on one screen does not reach another. Clearing browser data loses pending entries.
- **Clock skew.** `at` and `dayKey` come from the device clock. A wrong clock can put a zero-day or credit on the wrong day, or misjudge the 10-minute undo window. The hub should stamp its own receive time and refuse large skews.
- **Parent gate.** `pinOk` is a caller boolean. The real gate is Wright's hub-verified PIN. Until the hub key is on, a forged local entry can't be rejected server-side, but it stays "Not synced".
- **zeroDay and credit are ungated** because they are Atlas automation. A buggy claim-board detection could zero a kid's day wrongly. A parent `reverse` is the remedy, and Prism's disputed-close photo is the evidence.
- **Earning rate is not set.** No close-to-minutes or close-to-picks rate is seeded. Atlas and Dan must set it.
- **Redeems on a zero-day still count** (spent stays spent). Atlas should confirm this reading of "zeros that personal jar for the day".
