# Backpacker

Mobile-first prototype of a personal trip planner for independent travelers.

## Current scope

- One active trip.
- Trip items with type, status, day, time, price, paid amount, link and notes.
- AI trip draft from text or voice: text is parsed into ordinary trip fields and cards, while voice is transcribed before the same parse flow.
- Plan by days.
- All events grouped by status.
- Budget summary.
- Currency calculator for RUB / EUR / SEK with live-rate fallback to demo rates.
- Telegram-friendly share text.
- Trip PDF export with separate download/share actions.
- Read-only trip sharing by link via Supabase, enabled only for trips the author publishes.
- Separate `Со мной поделились` list for read-only trips saved from public links.
- Guest participation on shared trips: expense-share proposals and new idea proposals, accepted or rejected by the author.
- Minimal display profile for shared scenarios, still based on Supabase Anonymous Auth.
- iPhone PWA install readiness: Home Screen launch in standalone mode.
- Local persistence via `localStorage`.
- Unshared personal trips stay local. Shared-link management uses Supabase Anonymous Auth without a registration screen.
- No permanent accounts, collaborative editing, maps, booking integrations, or full multi-device sync.

## AI trip draft

`Создать новую поездку` can start a manual trip, a text-to-AI draft, or a voice-to-AI draft. Voice input is transcribed first, then the user can edit the text before sending it for parsing.

The OpenAI API key must be configured only as a Supabase Edge Function secret named `OPENAI_API_KEY`. It must never be committed or exposed in frontend config. The Edge Function `trip-draft-ai` does not store trip prompt text or audio in Supabase tables.

## Sharing with friends

Backpacker keeps personal unshared trips local. A trip is sent to Supabase only when the author opens link access from `Поделиться поездкой` → `Открыть доступ по ссылке`.

The public link opens a read-only trip. A guest can save it to `Со мной поделились`, reopen the latest version later, propose taking part of an expense, and suggest a new idea or event. These proposals do not change the trip immediately: the author reviews them in the trip proposal block and then accepts or rejects them.

If `Показывать смету` is disabled, financial fields are removed by the Edge Function response, not merely hidden in the UI. Shared actions use Supabase Anonymous Auth for technical ownership; there are no permanent accounts, email, phone, OAuth, contact lists, or cloud sync for personal trips yet.

## Beta device model

Backpacker is currently a beta. It is safest to plan a trip and use the app from one main device. Personal trips are stored locally, and shared actions are tied to the current anonymous browser or PWA session. A laptop browser, a mobile browser, and an installed PWA may be treated as different users.

## Demo

GitHub Pages URL after publishing:

`https://dphnll.github.io/Backpacker_demo/`

## Local usage

Open `index.html` in a browser.

The prototype is static and does not require a build step.

## Product docs

- `CHANGELOG.md`
- `BACKLOG.md`
- `BACKPACKER_MVP_SCOPE.md`
- `BACKPACKER_WIREFRAMES.md`
- `BACKPACKER_STABLE_V1_1_0_0.md`
- `PRODUCT_OVERVIEW.md`
