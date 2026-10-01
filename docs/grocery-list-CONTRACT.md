# Grocery list · CONTRACT (Ledger data + logic, Wright hosts the tile)

FIVE UPGRADES #2 (Dan, Thu Oct 1, 6:19 PM CT): the grocery tile becomes the list. Add, check and clear happen on the tile itself.
Costco is a filter on the same list, not a second tile. Nothing links out. No dollars.

**The wall list starts EMPTY** (Dan, Oct 1, 6:27 PM CT). The 9/25 items were already bought, so showing them as needed would be false. Every real item is still one tap away as a quick-add chip or a pick-list entry.

Branch `wall-redesign-ledger` only. Not wired into any page, not deployed, nothing live. The last-yes still applies.

## Files
| Path | Owner | What it is |
|---|---|---|
| `data/grocery-list.json` | Ledger (sole writer) | Seed list (empty), catalog, quick-add chips, and pick list in **one file**. There is no separate config file. |
| `house-grocery-list.js` | Ledger | Dependency-free UMD module. In the browser it is `window.HouseGroceryList`; in Node, `require()`. It follows the repo's root `house-*.js` layout. |
| `scripts/wall/grocery-list.test.mjs` | Ledger | `node --test scripts/wall/grocery-list.test.mjs` |
| `docs/grocery-list-CONTRACT.md` | Ledger | This file. |

## Seed file schema (`data/grocery-list.json`)
```json
{
  "version": 1,
  "asOfIso": "2026-10-01T18:28:00-05:00",
  "owner": "Ledger",
  "note": "…",
  "items":    [],
  "catalog":  [ { "id": "g-gallon-milk", "name": "Gallon milk", "store": "costco" }, { "id": "g-eggs", "name": "Eggs", "store": "any" }, "…" ],
  "quickAdd": [ "g-gallon-milk", "…" ],
  "pickList": [ "Eggs", "…" ]
}
```
- `asOfIso` is the top-level timestamp. It is named `asOfIso`, not `asOf`. It is **informational only**.
- `items` is **`[]`** in the seed, so the wall starts empty. If Ledger ever seeds a real need, it goes here in the item shape. A device that already has state gets it appended (see Merge).
- Item shape is fixed: `{ id, name, store: "any" | "costco", checked, addedAt }`.
  - `id` is a stable slug, `g-` followed by the lowercased name with `%` written as `pct` (`g-organic-1pct-milk`).
  - `addedAt` is ISO with the CT offset, stamped when the item is added on the wall.
  - `checked` is always `false` in the seed.
- `catalog` lists `{ id, name, store }` for **every real item** the wall may add. It is how chips and picks resolve their id and store.
  - The catalog id equals the item id once added (`g-<slug>`).
  - Gallon milk keeps `store: "costco"`, so adding it from its chip lands it in the Costco view. Everything else is `"any"`.
  - Every catalog item is offered as either a chip or a pick (a test asserts this).
- `quickAdd` holds the chips: Dan's frequent items, as **catalog ids**.
- `pickList` is a short list of **names** (12 or fewer) for the "more" picker. Each name resolves through the catalog (normalized name) to its id and store.
- `add()` with a `g-…` id that is not in the catalog returns `null`. It never makes an item literally named "g-…".
- **Writer:** Ledger seeds the file. The wall never writes it.

## Per-device state (built)
- localStorage key: **`wardos.grocery.v1`**
- Value: `{ "v": 1, "items": [ <item shape> ], "cleared": [ <ids> ] }`
- `cleared` holds the ids this device has cleared. It keeps a cleared seed item from coming back on the next load. Re-adding that item from a chip or the pick list works normally and drops the tombstone.
- **Merge on load:** device items come first, in their order. Seed items are appended only if the device has never seen them (by id or normalized name) and never cleared them. So a new Ledger seed reaches every screen, and one screen's check or clear never reaches another.
- If storage throws (private mode or blocked), the module falls back to in-memory state. It never throws to the tile.

## Shared cross-screen store: LAST-YES, NOT BUILT
- Reserved name: **`house.grocery.shared.v1`**, exported as `HouseGroceryList.SHARED_KEY_LAST_YES`.
- It would hold the same `{ v, items, cleared }` value for every House Face screen to read and write.
- Nothing reads or writes it today, and there is no backend. A test asserts that only `wardos.grocery.v1` is written.
- Building it needs Dan's last-yes.

## API surface (what Wright's tile calls)
Load: `<script src="house-grocery-list.js"></script>`, then `HouseGroceryList.load().then(list => render(list))`.

| Call | Returns | Semantics |
|---|---|---|
| `HouseGroceryList.load({ fetch?, storage?, now?, url? })` | `Promise<list>` | Fetches `data/grocery-list.json?t=<now>` (no-store), then merges it with `wardos.grocery.v1`. If the seed fetch fails, it still resolves with the device state. |
| `HouseGroceryList.create({ seed, storage, now })` | `list` | Synchronous version for tests and pre-fetched seeds. |
| `list.add(nameOrId, store?)` | item or `null` | Adds by catalog id (chip) or by name (pick). The catalog supplies id, name and store. `store` is `"any"` or `"costco"` (an explicit override); otherwise the catalog store applies, then `"any"`. Dedupe uses the normalized name (lowercase, apostrophes and punctuation stripped, whitespace collapsed): if the item is already on the list unchecked, nothing happens and that item is returned; if it is on the list checked, it is unchecked. Returns `null` for empty text or text that looks like a price, deal or link. |
| `list.toggle(id)` | item or `null` | Flips `checked`. Returns `null` for an unknown id. |
| `list.clearChecked()` | number removed | **Removes checked items only.** Unchecked items stay. |
| `list.filter("all" \| "costco")` | items | `"costco"` returns the items where `store === "costco"` (the Costco view). `"all"` (or anything else) returns everything, including Costco items. |
| `list.list()` | items | Everything, in list order (copies). |
| `list.quickAdd()` | `[{id,name,store,onList}]` | Chips. `onList` is true when an unchecked copy is already on the list, so the tile can dim the chip. |
| `list.pickList()` | `[{id,name,store,onList}]` | Short picker. Same `onList` meaning. |
| `list.asOfIso` | string or `null` | Seed time, informational only. |

Every return value is a copy, so mutating it does nothing. Every mutation persists right away. The module has no timers, sends nothing over the network, and only fetches inside `load()`.

## No keyboard
Adding happens only through quick-add chips and the short pick list. `add(name)` accepts free text for future use, but the wall shows no text field.

## No stale window
The list never expires. The tile shows **no stale badge** for the grocery list, and the module computes no age. `asOfIso` is informational only.

## No dollars, no links (Alfred scores zero dollars)
- The seed and the tile copy contain no dollars, prices, totals, deals, balances or links out.
- The guard is `HouseGroceryList.isUnsafe()`. `add()` refuses any name containing a currency sign (dollar, cent, euro or pound), a decimal number, `http(s):` or `www.`, or the words price, total, deal, sale, coupon, balance or bogo. Seed and saved items that fail the guard are dropped when they load.
- The test asserts that the seed has no dollar sign, no decimal price strings, no cents, no links and no deal or price words.
- The tile renders `name` only. It never renders a store link or an order number.

## Seed sources (no invented items, prices stripped)
Seed count: **0 items** (the list starts empty), **20 catalog** (19 `any` + 1 `costco`), **8 quickAdd**, **12 pickList**. The 8 chips plus the 12 picks cover all 20 catalog entries.

| Seed entry | Where | Source file |
|---|---|---|
| Organic 1% milk, Eggo French toast sticks, Cheese sticks, Apples, Grapes, Bananas, Baby carrots, Frozen cheese ravioli, Cherry tomatoes | catalog (`any`). The first 7 are chips; ravioli and cherry tomatoes are picks. They are NOT on the list, because they were bought 9/25. | `/workspace/kids-week-grocery/2026-09-25-hv-curbside-FINAL.md`. This is the "Cart ONLY" list for Hy-Vee order #44680011, placed Fri Sep 25. The order is confirmed by `/workspace/kids-week-grocery/hyvee-order-44680011-confirmation.png` and `/workspace/ledger/inbound/HyVee_2026-09-25_order44680011_*.txt`. |
| Gallon milk | catalog (`costco`) + chip | `/workspace/morning-board/2026-09-23-kids-week-grocery-plan.md`, "Costco — milk only" (Kirkland/conventional 1-gallon jugs). The name is kept generic because the source says "Kirkland/conventional". |
| quickAdd: Organic 1% milk, Gallon milk, Eggo French toast sticks, Cheese sticks, Apples, Grapes, Bananas, Baby carrots | chips | These items appear in **both** of the sources above: the 9/23 plan and the 9/25 placed cart. That makes them the repeat buys. |
| pickList (also in catalog, `any`): Eggs, Cheerios, Skippy peanut butter, Grape jelly, Mott's applesauce, King's Hawaiian slider buns, Bread, Butter, Celery, Frozen vegetables | pick list | `/workspace/morning-board/2026-09-23-kids-week-grocery-plan.md`, the Hy-Vee stage and Aldi walk list. The 9/25 order skipped them (the "DO NOT ADD" list for that order), so they are real buys but not on today's list. |

Left out as ambiguous: "Snacks (only if BOGO)", "Kellogg's kid cereal", "Chex Mix (or substitute)", "Nabisco multipack", "Di Lusso sliced ham/turkey/chicken", "Oikos Pro drinks vs 4-packs", kettle chips, crackers and frozen pizza (to keep the pick list short).
Not used: Hy-Vee weekly-ad and coupon scrapes (`/workspace/hyvee_*.txt`, `hyvee-weekly-flyer.json`). Those are store deals, not Dan's items, and they are full of prices. The old EXAMPLE/DEMO favorites on `sheet-groceries.html` are also excluded (Alfred P0, scrubbed in SHEETCLK3).
Prices in the sources were stripped. Store names, order numbers and totals are not carried into the seed.
