# Backpacker Context

Актуальный handoff после local patch checkpoint `1.1.2.44`.

## Current release

- Target version: `1.1.2.44`
- Release commit: pending local commit
- Public demo: `https://dphnll.github.io/Backpacker_demo/`
- Cache: `backpacker-pwa-v76`

## Done

- Stable mobile-first local trip planner baseline.
- Generic card copy flow: an existing `TripItem` can be copied to another day, `Без даты`, another trip, or `Без даты` in another trip; the source card stays unchanged and the copy receives a new id.
- Read-only sharing, received trips, expense proposals and item proposals.
- Out-of-range date fixes: items are preserved when trip dates change.
- AI Trip Draft with text/voice input, preview, quantity hardening and ordinary `Trip` / `TripItem` creation after confirmation.
- AI Link Intake: URL preview fills an editable item draft, then normal `saveItem` creates the ordinary card.
- Recoverable Auth: anonymous users can link email and later return to the same server-side identity.
- Cloud `TravelIdea` / `IdeaCollection` domain with owner-only RLS, optional collection, optional image metadata and soft archive.
- Ideas UI `1.1.2.42`: home entry, mobile Ideas screen, chips for `Все идеи`, `Без подборки` and named collections, manual create/edit/archive.
- Slice B `1.1.2.43`: an existing `TravelIdea` can choose a destination trip/day or `Без даты`, open an ordinary editable `TripItem` draft, and create the card only through normal `saveItem`.
- Patch `1.1.2.44`: Ideas navigation/style polish; home Ideas entry matches the create-trip card, Ideas header uses a chrome back button, and creating a new idea remains available through a floating `+`.

## Current step

Extension / Backpacker contract audit.

## Fixed sequence

1. Ideas UI v1 ✅
2. TravelIdea → editable ordinary TripItem flow ✅
3. Extension / Backpacker contract audit.
4. Idempotent ingestion identifiers.
5. Extension Connect + Ingestion API.
6. End-to-end smoke.
7. Return to unified AI flow: `Рассказать о поездке`.

## Invariants

- `TripItem` remains the canonical card inside a trip.
- `TravelIdea` is not a `TripItem`.
- `TravelIdea` does not require `tripId`.
- Copying or creating a card from a `TravelIdea` must not mutate, archive or delete the source `TravelIdea`.
- One `TravelIdea` can be used to create cards in several trips.
- The existing generic card copy/create destination flow should be reused; do not create a parallel picker.
- Extension does not write directly into Supabase tables.
- Personal trips remain local-first and do not become cloud-sync.
- Recoverable Auth restores server-side identity and links, not local-only trips from another device.

## Future Extension compatibility

- `collection_id` is optional; `Без подборки` means `collection_id = null`.
- Future ingestion should use stable source identifiers such as `sourceCollectionId` / `sourceIdeaId`.
- Collection matching must not rely on display title alone.
- Full two-way sync is outside the current scope.
- No Extension UI, ingestion API, recommendations, map or join table is implemented in `1.1.2.44`.
