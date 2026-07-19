# Backpacker

Mobile-first prototype of a personal trip planner for independent travelers.

Current public version: `1.1.2.43`.

## Current scope

- Local-first personal trips.
- Trip items with type, status, day, time, price, paid amount, link, location and notes.
- AI trip draft from text or voice: text is parsed into ordinary trip fields and cards, while voice is transcribed before the same parse flow.
- AI Link Intake: a URL can fill an editable item draft, then the user saves an ordinary trip card.
- Plan by days.
- All events grouped by status.
- Budget summary.
- Currency calculator for RUB / EUR / SEK with live-rate fallback to demo rates.
- Telegram-friendly share text.
- Trip PDF export with separate download/share actions.
- Read-only trip sharing by link via Supabase, enabled only for trips the author publishes.
- Separate `Со мной поделились` list for read-only trips saved from public links.
- Guest participation on shared trips: expense-share proposals and new idea proposals, accepted or rejected by the author.
- Minimal display profile for shared scenarios.
- Recoverable email access for anonymous users: email can be linked to the current Supabase user to preserve server-side profile/share data.
- Cloud Ideas: `TravelIdea` and `IdeaCollection` let the user keep places, links and wanted ideas before they belong to a concrete trip, then turn an idea into an editable ordinary trip card draft.
- iPhone PWA install readiness: Home Screen launch in standalone mode.
- Local persistence via `localStorage`.
- Unshared personal trips stay local. Server-side data is used for published shares, received links, proposals, recoverable profile identity and Cloud Ideas.
- No collaborative editing, maps, booking integrations, recommendations, Extension ingestion, or full multi-device trip sync.

## AI trip draft

`Создать новую поездку` can start a manual trip, a text-to-AI draft, or a voice-to-AI draft. Voice input is transcribed first, then the user can edit the text before sending it for parsing.

The OpenAI API key must be configured only as a Supabase Edge Function secret named `OPENAI_API_KEY`. It must never be committed or exposed in frontend config. The Edge Function `trip-draft-ai` does not store trip prompt text or audio in Supabase tables.

## Sharing with friends

Backpacker keeps personal unshared trips local. A trip is sent to Supabase only when the author opens link access from `Поделиться поездкой` → `Открыть доступ по ссылке`.

The public link opens a read-only trip. A guest can save it to `Со мной поделились`, reopen the latest version later, propose taking part of an expense, and suggest a new idea or event. These proposals do not change the trip immediately: the author reviews them in the trip proposal block and then accepts or rejects them.

If `Показывать смету` is disabled, financial fields are removed by the Edge Function response, not merely hidden in the UI. Shared actions use Supabase Auth for technical ownership.

## Recoverable access

Anonymous users can link an email to the current Supabase user. This preserves access to server-side profile, owned shares, received trips, proposals and Cloud Ideas for the same identity.

This is not full account sync: personal trips are still local-first and are not automatically restored on another device.

## Cloud Ideas

The `Идеи` entry on the home screen opens a mobile-first cloud list for places, links and wanted ideas before they belong to a specific trip.

- `travel_idea_collections`: optional user-owned collections.
- `travel_ideas`: user-owned ideas with title, type, optional URL, location, notes, price/currency and optional image metadata.
- `Все идеи` is a view across inbox ideas.
- `Без подборки` means `collection_id = null`.
- Archive is a soft status change, not delete.
- Current add-to-trip flow: `TravelIdea → destination → editable ordinary item form → Save → TripItem`.
- `TravelIdea` remains an independent reusable cloud source: adding it to one trip does not archive, delete or link it to that trip.
- Extension ingestion is still absent; ideas are created manually in Backpacker for now.

## Beta device model

Backpacker is currently a beta. It is safest to plan a trip and use the app from one main device. Personal trips are stored locally. Email access can restore the same server-side identity, but it does not move local-only trips between a laptop browser, mobile browser and installed PWA.

## Demo

GitHub Pages URL after publishing:

`https://dphnll.github.io/Backpacker_demo/`

## Local usage

Open `index.html` in a browser.

The prototype is static and does not require a build step.

## Product docs

- `CHANGELOG.md`
- `BACKLOG.md`
- `BACKPACKER_CONTEXT.md`
- `BACKPACKER_MVP_SCOPE.md`
- `BACKPACKER_WIREFRAMES.md`
- `BACKPACKER_STABLE_V1_1_0_0.md`
- `PRODUCT_OVERVIEW.md`
