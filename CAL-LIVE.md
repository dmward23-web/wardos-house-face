# Calendar live · House Face (CALFIX1)

**Honest gate:** GitHub Pages is static. dmward23 Google Calendar is the authority. Until Atlas refreshes `data/cal-live.json` from a fresh events dump, the leave-by / Next Up strip fail-closes to **CAL STALE** — **never** silently paints a day-lagged kids-week vanity (the Sun Sep 27 Jessy bug class).

## Live data flow

```
dmward23 (create / update / delete ANY event)
     ↓
Atlas (or Wright on-arrival): MCP list_events → events dump.json
     ↓
node scripts/cal-from-events.mjs --events dump.json --patch-week
     ↓
data/cal-live.json  +  kids-week.json  +  data/kids-week.json  +  kids-data.js EMBEDDED
     ↓  commit + push
House Face UI
  loads data/cal-live.json first
  Next Up = first upcomingLeaves[] with start > HouseClock.now
  fail-closed if missing / error / asOfIso ≠ Chicago today / age > 6h
```

- **Ingest ALL event classes:** Busy leaves, Free stubs, sports, therapy, travel, kids blocks — not Leave· only.
- **Past/done DROP forever** when `end`/`start` is before now — never manual board edit to clear.
- **Next Up** always advances to the real next calendar event (client-side filter inside a fresh window).
- **No Wright cron** (law). Atlas may attach standing refresh later.

## Run refresh (Atlas box / on-arrival)

```bash
cd /workspace/wardos-house-face   # or clone of wardos-house-face
# 1) Dump dmward23 primary (MCP list_events → save JSON; strip connector preamble ok)
# 2) Regenerate live slice + patch week glass
# Preferred (standing routine / on calendar write):
./scripts/house-board-calendar-refresh.sh /path/to/events-dump.json --deploy

# Or stepwise:
node scripts/cal-from-events.mjs \
  --events /path/to/events-dump.json \
  --out data/cal-live.json \
  --patch-week kids-week.json
# 3) Commit + push so Pages serves the new JSON
git add data/cal-live.json kids-week.json data/kids-week.json kids-data.js
git commit -m "CAL-live · snapshot $(date -u +%Y%m%d-%H%M)"
git push origin main
```

On **any** new Busy Leave (or any create/update/delete that should hit glass): re-run this path — **never silent park**.

### Suggested poll (Atlas-owned — do not create from Wright)

```cron
# Example only — Atlas attaches standing refresh; Wright does not install cron.
*/15 * * * * cd /path/to/wardos-house-face && \
  # dump via Atlas calendar tool → /tmp/dmward23-events.json && \
  node scripts/cal-from-events.mjs --events /tmp/dmward23-events.json --patch-week && \
  git add data/cal-live.json kids-week.json data/kids-week.json kids-data.js && \
  git diff --cached --quiet || (git commit -m "CAL-live · auto" && git push)
```

Suggested cadence: every 15 min while Dan is active, plus **on-arrival** after any calendar write.

## JSON contract (`data/cal-live.json`)

| `status` | UI |
|----------|----|
| `live` | Next Up from `upcomingLeaves` (if `fetchedAt` &lt; 6h AND `asOfIso` = Chicago today) |
| `error` | **CAL STALE** · show error · never paint lagged kids-week strip |
| `stale` | **CAL STALE** · UI may also force stale by age / day lag |

```json
{
  "status": "live",
  "source": "dmward23",
  "fetchedAt": "2026-09-28T16:00:00.000Z",
  "tz": "America/Chicago",
  "windowStart": "2026-09-28",
  "windowEnd": "2026-10-03",
  "asOfIso": "2026-09-28",
  "nextLeave": {
    "id": "…",
    "summary": "…",
    "start": "2026-09-28T15:00:00-05:00",
    "end": "2026-09-28T16:00:00-05:00",
    "location": "…",
    "busy": false
  },
  "upcomingLeaves": [ "/* all future events in window, sorted by start */" ],
  "boardStrip": {
    "label": "Next up · today",
    "time": "3:00",
    "place": "Ainsley — LKMS Homework Help",
    "detailHtml": "<strong>3:00</strong> …",
    "badge": "Mon"
  },
  "error": null
}
```

Note: field name `nextLeave` / `upcomingLeaves` kept for strip compatibility — values are **all** upcoming event classes (Free included). Hero = true next by start (Busy wins same-start ties).

## UI rules (`house-board-strip.js`)

- Load `data/cal-live.json?v=Date.now()` **first**.
- Paint Next Up only when `status === "live"` AND age &lt; **6h** (`CAL_FRESH_MS`) AND `asOfIso === HouseClock.iso`.
- Inside a fresh window: recompute Next Up from `upcomingLeaves` filtered `start > now` — never lock a past `boardStrip`.
- Else → place `CAL STALE`, real reason in detail / `[data-live='asof-warn']`. **Never** fall through to day-lagged kids-week vanity.
- Kids-week remains chore/quest/jar authority; calendar clock owns Next Up / dan leave rows after `--patch-week`.

## Ownership

- **Wright** owns kit tiles + repo scripts/UI fail-closed.
- **Atlas** owns calendar content last-look + standing refresh / on-arrival dump→script→push.
- **No Dan ping** for routine refresh. No new bot. No Wright cron.
