# GAUP — GitHub Actions Upgrader

## What This Is

Client-side web tool at gaup.deknijf.com. Paste a GitHub Actions workflow
YAML, press Upgrade, and it upgrades every `uses:` action reference to the
latest release tag via the GitHub API. No backend — runs entirely in the
browser.

- **Repo:** github.com/rdeknijf/gaup
- **URL:** https://gaup.deknijf.com
- **Stack:** Vanilla HTML + CSS + JS, no build step, no dependencies

## Architecture

Three source files in `src/`:

- `index.html` — two textareas (input/output), Upgrade + Copy buttons, status area
- `app.js` — regex to find `uses:` lines, fetch latest release tag, replace
- `style.css` — minimal CSS with dark mode support

No build step. Cloudflare Pages (or any static host) serves `src/` directly.

## How It Works

1. Regex parses all `uses: owner/repo/subpath@ref` lines from the input
2. Deduplicates by `owner/repo` (sub-actions share the parent repo)
3. SHA-pinned refs (40-char hex) are skipped — user pinned those deliberately
4. Fetches `https://api.github.com/repos/{owner}/{repo}/releases/latest` for each
5. Uses `Promise.allSettled` — failed lookups don't block successful ones
6. Replaces refs in the output, shows per-action status (updated/failed/skipped)

## Limitations

- GitHub API rate limit: 60 requests/hour unauthenticated (enough for typical workflows)
- Actions without GitHub Releases (tag-only repos) will show as failed
- Local/reusable workflow refs (`.github/workflows/...`) are not matched (by design)

## Deployment

Cloudflare Pages project `gaup`, custom domain `gaup.deknijf.com`.
CNAME record `gaup` -> `gaup.pages.dev` (proxied) in Cloudflare DNS.
No build command — Pages serves `src/` directly.

To redeploy: `wrangler pages deploy src --project-name gaup`
