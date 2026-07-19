# Backpacker Context

Актуальный handoff после public release `1.1.2.42`.

## Current release

- Public version: `1.1.2.42`
- Release commit: `6a261c6f3a36d4dfd11941906f9bedaa4960aa77`
- Public demo: `https://dphnll.github.io/Backpacker_demo/`
- Cache: `backpacker-pwa-v74`

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

## Current step

Slice B: `TravelIdea → existing generic card create/copy flow`.

The intended product path:

`TravelIdea → ordinary editable TripItem draft → existing destination picker → ordinary TripItem with a new id`.

## Fixed sequence

1. Slice B: map `TravelIdea` into existing generic card create/copy flow.
2. Extension / Backpacker contract audit.
3. Idempotent ingestion identifiers.
4. Extension Connect + Ingestion API.
5. End-to-end smoke.
6. Return to unified AI flow: `Рассказать о поездке`.

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
- No Extension UI, ingestion API, recommendations, map or join table is implemented in `1.1.2.42`.
