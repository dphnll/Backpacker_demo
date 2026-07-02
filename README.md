# Backpacker

Mobile-first prototype of a personal trip basket for independent travelers.

## Current scope

- One active trip.
- Trip items with type, status, day, time, price, paid amount, link and notes.
- Plan by days.
- Basket grouped by status.
- Budget summary.
- Currency calculator for RUB / EUR / SEK with live-rate fallback to demo rates.
- Telegram-friendly share text.
- Trip PDF export with separate download/share actions.
- Read-only trip sharing by link via Supabase, enabled only for trips the author publishes.
- Separate `Со мной поделились` list for read-only trips saved from public links.
- iPhone PWA install readiness: Home Screen launch in standalone mode.
- Local persistence via `localStorage`.
- Unshared personal trips stay local. Shared-link management uses Supabase Anonymous Auth without a registration screen.
- No permanent accounts, collaborative editing, maps, booking integrations, or full multi-device sync.

## Demo

GitHub Pages URL after publishing:

`https://dphnll.github.io/Backpacker_demo/`

## Local usage

Open `index.html` in a browser.

The prototype is static and does not require a build step.

## Product docs

- `CHANGELOG.md`
- `BACKPACKER_MVP_SCOPE.md`
- `BACKPACKER_WIREFRAMES.md`
- `BACKPACKER_STABLE_V1_1_0_0.md`
- `PRODUCT_OVERVIEW.md`
