# ONE handoff — GitHub Pages for durable House Face HTTPS

## Blocker
GitHub is **not connected** on this box (`gh` not logged in; Cursor GitHub MCP: `scm_not_connected`).

## What Dan does (one step)
Connect GitHub for this Cursor account / run `gh auth login` on the box (browser or token). Then tell Prism: **GitHub connected — deploy House Face Pages.**

## What happens after auth (agent will do)
1. Create public repo (e.g. `wardos-house-face`) from `/tmp/house-face-deploy` (or `/workspace/board-os/house-face`)
2. Push `main` with `.nojekyll` + static files
3. Enable GitHub Pages: Deploy from branch `main` / root
4. Lasting URL: `https://<user>.github.io/wardos-house-face/sheet-index.html`
5. iPhone/iPad/Mac: open that URL in Safari → Share → Add to Home Screen (iPad) / Add to Dock (Mac)

## Ready now
- Deploy tree: `/tmp/house-face-deploy` (PWA manifest, apple-touch-icon, icons, sheet-index entry)
- Source of truth: `/workspace/board-os/house-face`
- Drive zip backup: already on Drive Weekday (done — not blocking)
