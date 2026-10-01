# GROCERY CONTRACT · pointer (Wright hosts the tile, Ledger owns the list)

**The contract is Ledger's own doc: [`docs/grocery-list-CONTRACT.md`](../grocery-list-CONTRACT.md)**, cherry-picked onto `wall-redesign-1` from Ledger's local `wall-redesign-ledger` (27e0877 → a8c6eb8, 3ebd8cd → 5535d31). Where the two differ, Ledger's doc wins. This file only records how the wall hosts it.

- Seed `data/grocery-list.json` `{version, asOfIso, owner, note, items[], catalog[], quickAdd[], pickList[]}`. Ledger writes it; the wall never edits it. Items start EMPTY. There are 20 catalog entries (1 Costco: `g-gallon-milk`), 8 quick-add chips and a 12-name pick list.
- Module `house-grocery-list.js` (`window.HouseGroceryList`) is **hosted as-is** (not edited). wall.html calls `HouseGroceryList.create({seed, storage: localStorage})` and then:
  - `filter('all'|'costco')`
  - `quickAdd()` (chips)
  - `pickList()` (the More picker)
  - `add(id)`
  - `toggle(id)`
  - `clearChecked()`
  - `list()`
- Per-device state lives in localStorage `wardos.grocery.v1`. `house.grocery.shared.v1` needs Dan's last-yes and is **not built**.
- The tile:
  - It is **hidden while `data/grocery-list.json` is absent**.
  - An empty list shows only the chips and the More pick list, with no placeholder text.
  - Costco is a filter on the same list, not a second tile.
  - There is no keyboard, no link out, no dollars, no stale window and no stale badge.
- My earlier provisional grocery shape and fallback code were dropped (superseded by Ledger's lane).
- Tests: Ledger's `node --test scripts/wall/grocery-list.test.mjs` (12). The wall guard checks that the tile has no link and loads Ledger's module.
