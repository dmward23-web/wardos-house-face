# Nice one + jar tile (NICEONE1 / JARTILE1) · Wright · branch `wall-redesign-1` · NOT LIVE

Law: CHORE LAW, locked by Dan Thu Oct 1 2026 8:01 PM CT. The jar is Ledger's tile and pays time and picks, never cash. Balances are never listed. This supersedes the 7:54 PM weekly $ total and the cash Nice one, so there is no `data-money` element. The only `$` anywhere is still Ainsley's `$15/hr`.

## Jar tile (wall.html `#w-jar`, hub `sheet-index.html` `[data-house-jar]`)
- It renders only Ledger's `HouseJar` `book.wallDisplay()`: the printed rule, the jar names (Family jar, Harris, Hayes, Ainsley) and `syncLabel` ("Not synced").
- No numbers, fill levels, balances or `$`.
- Hidden when `house-jar.js` or `data/house-jar.json` is missing.
- Module: `house-jar-wall.js` (`window.HouseJarWall`). Ledger's files (`house-jar.js`, `data/house-jar.json`, `docs/house-jar-CONTRACT.md`) are cherry-picked from JAR1 `ffd1c85` as-is.

## Nice one (wall + hub seat cards only; never `kid-*.html`)
1. A 1.5 s press-and-hold with a `<progress>` indicator opens the panel. A short tap does nothing.
2. The panel shows an on-screen 4-digit PIN pad (buttons only, no input element, no keyboard).
3. The PIN is verified on the hub (`POST /api/nice-one/verify`), never in the browser.
4. Next come Ledger's chips (+10 min / +15 min / +1 pick) and the seed's reasons, then Give.
5. The hub spends the one grant for a uuid `tapId` (`POST /api/nice-one/consume`). Only then does `book.niceOne({jar, chip, reason, pinOk:true})` run, with the `parentGate` hook armed for that single call.
6. "Jar totals" (`parentView`) shows numbers only inside this gated panel. It uses `POST /api/nice-one/check`, which does not spend the grant.
7. The whole control is hidden until `GET /api/nice-one/status` says `{pinSet:true}`. With no hub key there is no request.

## Hub route (`scripts/lights-write-proxy.mjs` → `scripts/house/nice-one.mjs`)
- Runs after the proxy's `checkAuth` gate, with the same hub key as Sensi/Kasa. No key → 401.
- `status` → `{pinSet}` only. The hash, tries and lock state are never returned.
- No PIN set → 503 `not-configured`, and no attempt is spent.
- 5 wrong PINs → 423 locked for 10 min. The lock persists in `~/.config/wardos/parent-pin-lock.json` (600), so it survives a restart.
- One grant per verify, valid 60 s and single use. Token compare is constant-time.
- `tapId` replay → `{ok, duplicate:true}`, persisted in `~/.config/wardos/nice-one-taps.json` (600).
- No book writes on the hub: Ledger's book writes client-side (`wardos.jar.pending.v1`, `SHARED_WRITE_ENABLED=false`).
- `TAP_KEY_RE` is unchanged; `house.jar.shared.v1` waits for Dan's last-yes.

## PIN (`scripts/parent-pin.mjs`, run on the hub)
```
cd <repo on the hub>
node scripts/parent-pin.mjs set      # type 4 digits twice at the hidden prompt
node scripts/parent-pin.mjs status   # "parent PIN: set"
# restart lights-write-proxy so it runs the NICEONE1 build (last-yes: proxy restart)
node scripts/parent-pin.mjs clear    # removes the PIN + lock; Nice one hides again
```
- The PIN is stored as a salted scrypt hash in `~/.config/wardos/parent-pin.json` (mode 600).
- `.gitignore` and the `nice-one` test guard keep any PIN, lock or grant file out of git.

## Known limits
- **Not synced.** Every screen keeps its own queue until Dan's last-yes on `house.jar.shared.v1`.
- **`pinOk` is a client-side boolean.** Someone with devtools on the wall could append a local entry. While `SHARED_WRITE_ENABLED=false`, nothing is shared and the entry stays "Not synced".
