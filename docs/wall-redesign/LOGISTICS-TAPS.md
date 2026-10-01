# Logistics taps (ATLASLANE6, upgrade 4): contract

Four taps replace the family logistics text. Atlas owns the state and the copy (`scripts/house/logistics-lib.mjs`). Wright wires the controls. Not wired, not live.

## Controls (`data/logistics-taps.json` → `controls`)
| id | label | input | writes | lights (Dan's decisions) | thermostat |
|---|---|---|---|---|---|
| `im-home` | I'm home | tap | status line | `kitchen` + `dining-room` ON | untouched |
| `leaving` | Leaving | tap | status line | all Kasa OFF: `dining-room`, `harris-room`, `kitchen` | untouched |
| `check-in` | Check in | one tap per kid: Harris, Hayes, Ainsley | who-home (`checkedInAt`) + status line | none | untouched |
| `running-late` | Running late | one chip: 5 / 10 / 15 / 20 / 30 (`lateChips`) | status line (carries the minute) | none | untouched |

- No keyboard, no free text, no thread. Anything that isn't one of these (another minute, another name, another control) is ignored.
- **Nothing sends to a person.** No SMS, email, Slack, Harbor, push or network call. `applyTap()` returns `effects.sends: []` every time; the lib has no network code (test).
- Lights: `effects.lights` is the plan for Wright's existing scene buttons (SCENES.md, `HouseLights.setLight`). Thermostat stays with its own Travel / Back home button.
- Need a ride stays on Pack (`data/pack-flags.json`), unchanged.

## State
```
{ date: <house day>, resetsAt: <next 3:00 AM CT>, status: {control, line, at} | null,
  taps: [{control, at, kid?, minutes?}], generatedAt, controls, lateChips,
  sendsToPeople: false, perDevice: true, shared: {enabled: false, …}, note }
```
- House day resets at 3:00 AM CT (same as who-home). The latest tap wins the status line.
- Copy (h:mm, no am/pm, sentence case, trailing period, no `!`): `Home 6:05.` · `Leaving 8:05.` · `Running 15 min late.` · `Ainsley home 5:52.`
- API: `applyTap(state, whoHome, {control, kid?, minutes?}, now)` → `{logistics, whoHome, effects}`; `logisticsFor(state, now)` normalizes / resets.

## Shared across screens: documented, OFF (last-yes)
Per-device today (localStorage on the wall, like Pack flags). Sharing needs a new allowed key on the hub tap endpoint (`/api/taps` accepts only `house-checkoffs:` keys), which is a last-yes item:
- key `house-logistics:<YYYY-MM-DD house day>`, ids `home`, `leaving`, `late-5` … `late-30`, `checkin-harris|hayes|ainsley`
- value `{v: true, t: <epoch ms>}` (same shape as chore taps); latest `t` wins.
- `toHubEntries()` / `fromHubEntries()` implement the mapping and are tested; `shared.enabled` stays `false` until Dan says yes.
