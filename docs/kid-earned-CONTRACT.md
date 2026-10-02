# Kid weekly earned book · CONTRACT (Ledger book + math, Wright renders the seat)

Source: BRIEF.md "DAN 7:54 PM: WEEKLY EARNED TOTAL + NICE-ONE BONUS". It overrides JAR REMOVED for this one feature only.
- Each seat (Harris, Hayes, Ainsley) shows the dollars earned this week.
- A parent-only tap adds a "nice one" bonus from fixed chips. There is no keyboard.
- Old jar visuals, balances and per-chore amounts stay off the wall.
- Alfred re-scopes the zero-$ check to allow only this total and Ainsley's `$15/hr` tag.

Branch `wall-redesign-ledger` only. The book is not wired into any page and not deployed. Nothing here is live, and the hub endpoint is unchanged.

## Files
| Path | What it is |
|---|---|
| `data/kid-earned.json` | Seed. Ledger is the only writer. It holds the kids, week rule, current weekKey, chips, undo window and `entries: []`. |
| `house-kid-earned.js` | UMD module, `window.HouseKidEarned` (Node: `require`). It has no dependencies and no timers. The only network calls are `load()` and the flag-gated `pushShared()`. |
| `scripts/wall/kid-earned.test.mjs` | `node --test scripts/wall/kid-earned.test.mjs` (14 tests). |

## Entry shape (append-only book)
```json
{ "id": "b-hayes-1790000000000-k3x9", "kid": "harris|hayes|ainsley", "type": "earned|bonus",
  "amount": 200, "reason": "Great attitude", "at": "2026-10-01T20:00:00-05:00", "weekKey": "2026-09-25",
  "reversalOf": "<id>  (reversals only)", "sourceId": "<tap source>  (earned only)" }
```
- `amount` is in **integer cents**. Non-integers, zero, and values over 100000 are refused.
- A negative amount is allowed **only** with `reversalOf`.
- A positive bonus amount must equal a chip. An off-chip bonus that arrives by sync is refused as well.
- `at` is ISO with an offset. `weekKey` is computed from `at` with the week rule when the entry is written, and stored on the entry.
- Ids:
  - Bonus: `b-<kid>-<epochms>-<rand4>`, generated on the device.
  - Earned: `e-<kid>-<sourceId>`, deterministic. A re-tap after an undo gets `-2`, `-3` and so on, also deterministic.
  - Reversal: `r-<originalId>`.
  - The earned and reversal ids are the same on every device, so two screens recording the same tap or the same undo produce one entry.
- **Idempotent:** `apply(entry)` with an id already in the book is a no-op. **Sync is a union by id** (`merge(entries)`), so resync can never double-pay.
- **Nothing is ever deleted.** Undo appends a reversal.

## Totals are derived, never stored
For each kid and week, read only entries where `weekKey === current`:
- `earnedCents = clamp(sum(earned), 0, earnedCapCents)`. The cap per kid comes from the existing `kids-week.json` `bankGoal.weeklyAllowance`: Harris 1000, Hayes 1000, Ainsley 2000. It applies to earned only.
- `bonusCents = max(0, sum(bonus))`. Bonuses sit on top of the cap.
- `totalCents = earnedCents + bonusCents`.
- `bonusCount` counts the bonuses that have not been reversed.

There is no balance and no bank key, and the module never writes a total. Earned is **partial**: it is the sum of what was actually earned. There is no all-or-nothing gate.

## Week rule (existing repo convention used, per the brief)
- The brief proposed Sun 00:00 to Sat 23:59:59 CT. The repo already has a Dad-week and payday convention, so this book uses that instead:
  - **The week runs Fri 3:00 PM to the next Fri 3:00 PM, America/Chicago.**
  - `weekKey` is the date of the starting Friday (`YYYY-MM-DD`). This matches `house-checkoffs:{kid}:week:{FriISO}`.
  - Sources: `kids-data.js:53-77` (homeWeek / `weekStartIso`), `house-checkoffs.js:3`, the `kids-week.json` bankGoal blurbs ("Fri 3:00p→Fri 3:00p"), and Atlas unlocks "Fri→Fri".
  - Payday stays Fri 6:00 PM CT (`kids-data.js:798-810`), after the week closes.
- The rule is set by `data/kid-earned.json` `week`. Changing it to `{ "rule": "sun-0000" }` switches to the brief's Sunday week, and both rules are tested.
- DST is handled with `Intl` in America/Chicago: the week key comes from calendar dates, not 24-hour arithmetic. The tests cover the DST-end week (Nov 1 2026) and DST start (Mar 14 2027) under both rules.
- **Reset** means the display filters to the current weekKey. Older entries stay for history and payout audit (`totals("2026-09-25")`).
- Current weekKey at seed time (Thu Oct 1, 8:05 PM CT): **`2026-09-25`**. It rolls to `2026-10-02` at Fri Oct 2, 3:00 PM CT.

## API (`HouseKidEarned`)
| Call | Returns | Notes |
|---|---|---|
| `load({fetch?, storage?, now?, parentGate?, url?})` | `Promise<book>` | Fetches `data/kid-earned.json` (no-store), then merges in this device's pending entries. If the fetch fails, it still resolves. |
| `create({seed, storage, now, parentGate, fetch, hubBase})` | `book` | Synchronous version, for tests. |
| `book.addEarned({kid, sourceId, amountCents, reason?, at?})` | `{ok, entry\|noop\|error}` | Atlas's chore-done path. Not parent-gated. `sourceId` must be a stable tap id that includes the day or week, e.g. `har-bed-2026-09-27` or `har-toys-week-2026-09-25`. If the tap is already live, the call is a no-op. |
| `book.undoEarned({kid, sourceId})` | `{ok, entry\|noop}` | Atlas un-tap. Appends a reversal. |
| `book.addBonus({kid, amountChip, reasonChip, pinOk})` | `{ok, entry}` or `{ok:false, error}` | `amountChip` is the cents value or label of a chip (`100` / `"$1"`). `reasonChip` is a reason id or its exact label. Errors: `parent-gate`, `bad-kid`, `amount-not-a-chip`, `reason-not-a-chip`. |
| `book.undoBonus(id, {pinOk})` | `{ok, entry}` or `{ok:false, error}` | Allowed for ≤ 10 min after the bonus's `at`. Appends `r-<id>` with `-amount` and `reversalOf: id`. A second undo is a no-op. Errors: `parent-gate`, `not-a-bonus`, `undo-window-closed`. **The gate also applies to undo.** That is why the call takes a second argument the brief's `undoBonus(id)` does not show: without it, a kid could undo a sibling's bonus. |
| `book.display(nowMs?)` | `{weekKey, kids:[{kid, name, weekTotal, bonusCount}], synced, syncLabel}` | **This is the only thing a seat renders.** |
| `book.totals(weekKey?)` | per kid `{earnedCents, bonusCents, totalCents, bonusCount}` | Ledger and audit use only. Not for the wall. |
| `book.apply(entry)` / `book.merge(entries)` | `bool` / count of new entries | Idempotent union. |
| `book.syncState()` | `{sharedWriteEnabled, sharedKey, pendingKey, pendingCount, synced, label}` | |
| `book.pushShared()` | `Promise` | With the flag off: `{ok:false, reason:"shared-write-off"}` and **no request is made**. |
| `book.bonusAmounts()` / `book.bonusReasons()` / `book.entries()` / `book.pending()` / `book.weekKeyNow()` | copies | |
| `HouseKidEarned.weekKeyFor(ms, week)`, `formatCents(c)` | | |

## Wall display contract
- Per kid, the seat shows `weekTotal`, formatted as `$7` or `$7.50` (a cents part only when it is non-zero), and an optional `bonusCount`.
- It shows **no** per-chore dollar amount, no reasons, no chore ids, no balance, no jar, no goal, no payout and no links out. A test asserts that `display()` carries exactly three `$` strings and nothing else money-related.
- The seat must show `syncLabel` ("Not synced") while `synced === false`.
- Chips (fixed, from the seed):
  - `bonusAmounts`: `$1` (100), `$2` (200), `$5` (500).
  - `bonusReasons`: Kind to a sibling, Helped without asking, Great attitude, Extra effort, Good listener.

## Parent gate
- No parent PIN or long-press exists in the repo or on `wall-redesign-1` (`ba2b4c4`, or the tip `f69cb6c`). `scripts/parent-pin.mjs` is named in BRIEF.md (Dan 7:55 PM) but does not exist yet.
- The book enforces this: `pinOk` must be the boolean `true` (not `"true"`, `1`, or a PIN string). If `create({parentGate})` is supplied, `parentGate({action:'bonus'|'undo', kid})` must also return `true`.
- **Wright supplies the gate:** a 1.5 s hold, then a PIN pad verified **on the hub** with a 5-try lockout. `pinOk = true` is set only from the hub's verify response. The PIN never comes to this module.

## Shared write path: DESIGNED, OFF (LAST-YES, Dan)
- `SHARED_WRITE_ENABLED = false` is set in the module. Flipping it needs Dan's last-yes.
- **Today this is NOT a shared source of truth.** Each screen sees the Ledger seed (`entries: []`) plus its own pending entries. A bonus tapped on the hallway wall does not appear on any other screen.
- What the wall does until then:
  1. It reads the seed `data/kid-earned.json`.
  2. It appends local entries to the queue in localStorage **`wardos.kidEarned.pending.v1`** (`{v:1, entries:[…]}`). The queue survives reload.
  3. `display()` returns `synced:false, syncLabel:"Not synced"`, and the seat must show it.
  4. `pushShared()` makes no request.
- Proposed hub key: **`house.kidEarned.shared.v1`** on the existing hub tap endpoint `/api/taps` (`scripts/lights-write-proxy.mjs:402`). The endpoint and its allow-list are **not changed** here. Today it accepts only `house-checkoffs:` keys (`:108`).
  - POST body: `{ changes: [ { key: "house.kidEarned.shared.v1", id, entry } ] }`
  - Server rules (to build after last-yes):
    - Validate the entry against the shape and rules above, including chip amounts, integer cents and `reversalOf` on negatives.
    - **Append only, deduped by id.** An existing id is ignored and never overwritten. There is no last-writer-wins and no delete.
    - Store the entries in the hub store next to `kid-taps.json`.
    - Respond `{ ok, kidEarned: [all entries], kidEarnedIds: [acked ids] }`.
    - Bonus entries should be accepted only with a valid server-side PIN session for the tap id.
  - Client sync is a union: the device merges `kidEarned` and drops the acked ids from pending.
- Ledger's payout audit reads the same union.

## Risks
- **Not truly shared until Dan's last-yes on the hub key.** Each screen keeps its own pending book, and totals can differ between screens. "Not synced" must stay visible. A page reload keeps pending entries, but clearing browser data loses them.
- **Integer cents everywhere.** Floats are refused, and `formatCents` is the only place `$` is produced.
- **Clock skew.**
  - `at` and `weekKey` come from the device clock. A screen with a wrong clock can file an entry in the wrong week, or misjudge the 10-minute undo window, which uses `Date.parse(orig.at)` against the local now.
  - The hub should stamp a server `receivedAt` and may reject entries whose `at` is more than about 10 minutes from server time.
  - Week membership uses the stored `weekKey`, so it is stable once written.
- **Parent gate.** `pinOk` is a boolean from the caller. The book cannot prove a parent was there, so the real gate is Wright's hub-verified PIN. Until the hub key is on, the hub also cannot reject a forged local entry. Anyone with devtools on the wall could append a local bonus, but it stays "Not synced" and never reaches Ledger.
- **Earned source.** Earned entries depend on Atlas calling `addEarned` with a stable `sourceId` and an amount. Per-chore rates live in `kids-week.json` (`quests[].stars` × `bankGoal.starDollar`) and must never reach the wall. The seat only gets `weekTotal`.
- **Sibling comparison.** Three dollar totals sit side by side on the seats. That is Dan's call (7:54 PM), but it conflicts with the earlier rule "Ainsley: nothing her brothers could use to needle her … No dollars, ever". Flag it to Alfred.
