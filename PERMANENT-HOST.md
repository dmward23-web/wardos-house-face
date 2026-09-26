# House Face · permanent host plan

## Live interim (box-bound)
Quick Cloudflare tunnel → dies if box sleeps / process stops.
Use only to Add to Home Screen / Dock today.

## Durable (needed for always-on desktop + home iPad)
**Blocker now:** GitHub CLI not logged in; Cursor GitHub MCP `needsAuth`.
No Netlify/Vercel/Cloudflare API token in environment.

### Preferred next one step (Prism → Dan)
Connect GitHub on this box (Cursor GitHub MCP auth, or `gh auth login`), then:
1. Create public repo `wardos-house-face` (or under existing org)
2. Push `/workspace/board-os/house-face/` (static only)
3. Enable GitHub Pages → Deploy from `main` / root (or `/docs`)
4. Lasting URL: `https://<user>.github.io/wardos-house-face/sheet-index.html`
5. Re-do Add to Home Screen / Dock once from that lasting HTTPS URL

### Alternatives (also need one login)
- Cloudflare named tunnel + custom hostname (Cloudflare account)
- Netlify Drop / Cloudflare Pages (account once)

## Offline backup
Drive zip already uploaded (see Prism return).
