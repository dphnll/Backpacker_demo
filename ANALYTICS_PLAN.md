# Backpacker analytics plan

## Purpose

Backpacker analytics should show whether people can use the app as a real travel-planning tool, not just count visits.

The core questions:

- did the user understand the mechanics;
- did the user create their own trip, not only play with the trainer;
- did the user receive the first product value;
- did the user assemble a working plan;
- did the user return to the same trip;
- did the user open Backpacker before or during real trip dates;
- where users open flows but do not complete them.

Analytics must not collect personal travel content.

## Tool split

- PostHog: product behavior, event funnels, paths, retention and product milestones.
- Google Sheet via Telegram bot: qualitative feedback from testers.

Google Sheet is not used for high-volume product analytics.

## Privacy boundary

Never send to analytics:

- trip names;
- destinations;
- locations;
- notes;
- links;
- uploaded images;
- Telegram usernames;
- phone numbers;
- exact trip dates;
- any free-text field.

Safe properties:

- anonymous user id;
- session id;
- opaque technical ids: `trip_id`, `item_id`;
- controlled enums;
- counts;
- booleans;
- buckets;
- product phase labels.

## Analytics versions

Every event must include:

- `analytics_schema_version`: current value `2026-07-01.1`;
  the previous value `2026-06-25.1` remains a valid historical value and must not be deleted or overwritten;
  see "Feature analytics — July observation release" for the migration strategy;
- `app_version` or `release_id`: current release marker;
- `environment`: `production | local | preview`;
- `is_internal_user`: boolean;
- `is_test_user`: boolean.

Onboarding events must include:

- `onboarding_version`.

Trainer events must include:

- `trainer_version`.

Milestone events must include:

- `definition_version`.

Optional:

- `research_session_id` as a non-personal, manually assigned test cohort id.

## Trip origin rules

Every trip-scoped event must include:

- `trip_id`: opaque UUID without user content;
- `trip_origin`: `demo | user_created`.

Rules:

- demo trainer actions are tracked separately;
- demo trainer actions must not count toward user-trip activation;
- user-created trip funnels must filter `trip_origin = user_created`;
- trainer funnels must filter `trip_origin = demo`;
- aggregated app engagement may include both, but reports must label the mix clearly.

## Technical identifiers

Use technical IDs only. Never derive IDs from trip names, destinations, dates or item titles.

Rules:

- every trip-scoped event includes `trip_id`;
- every item-scoped event includes both `trip_id` and `item_id`;
- `trip_id` is required to measure return to the same trip;
- `item_id` is required to understand create/update/move/delete behavior without sending item content.

## Internal and test traffic

We need a lightweight rule without backend auth.

Recommended first implementation:

- `is_internal_user` from localStorage flag or query param, for example `?internal=1`;
- `is_test_user` from localStorage flag or query param, for example `?test_user=1`;
- keep internal and test users visible, but exclude them by default from product dashboards;
- create a separate dashboard for tester behavior.

No person names or Telegram usernames should be sent.

## Activation ladder

Backpacker activation is not one linear funnel for everyone. Use this ladder as the product model:

1. Awareness: user opens the app and sees the value proposition.
2. Mechanics understood: user interacts with trainer or opens key sections.
3. Own trip created: user creates a user trip.
4. First value reached: user adds enough structured content to feel the app working.
5. Working plan reached: user assembles a plausible multi-day trip plan.
6. Value confirmed: user returns and performs another useful action, especially before or during trip dates.

## Milestone thresholds

Thresholds are a product hypothesis and must live in one configurable place during implementation.

Suggested config:

```js
const ANALYTICS_MILESTONE_CONFIG = {
  definitionVersion: "2026-06-25.1",
  firstValue: {
    minItems: 3,
    minScheduledItems: 1,
    meaningfulFields: ["price", "paidAmount", "link", "startTime", "notes", "priority"],
  },
  workingPlan: {
    minItems: 8,
    minScheduledDays: 2,
    minScheduledShare: 0.5,
    minTypes: 3,
    planningSignals: ["budget", "price", "paidAmount", "status", "priority"],
  },
};
```

`meaningfulFields` and `planningSignals` count only when the field is explicitly filled or changed by the user, or differs from a technical default value.

Default `status` and default `priority` do not automatically count as product value.

### `trip_first_value_reached`

Send once per user-created trip when all conditions are true:

- `trip_origin = user_created`;
- at least 3 items;
- at least 1 item assigned to a day;
- at least 1 item uses a meaningful field beyond title and type:
  price, paid amount, link, time, note or priority.

Properties:

- `trip_id`;
- `definition_version`;
- `item_count`;
- `scheduled_item_count`;
- `meaningful_field_count`;
- `trip_phase`;
- `days_until_trip_bucket`.

### `trip_working_plan_reached`

Send once per user-created trip when all conditions are true:

- `item_count >= 8`;
- `scheduled_share >= 0.5`;
- `scheduled_day_count >= min(2, trip_days_count)`;
- `type_count >= 3`;
- at least one explicitly set planning signal is used: budget, price, paid amount, status or priority.

For a multi-day trip, two scheduled days and the scheduled item share are joint conditions, not alternatives.

Properties:

- `trip_id`;
- `definition_version`;
- `item_count`;
- `scheduled_item_count`;
- `scheduled_day_count`;
- `scheduled_share_bucket`;
- `type_count`;
- `has_budget`;
- `has_costs`;
- `has_paid_amounts`;
- `has_statuses`;
- `has_priorities`;
- `trip_phase`;
- `days_until_trip_bucket`.

### Future: `trip_value_confirmed`

Send once per user-created trip when all conditions are true:

- same `trip_id`;
- new session, based on the standard PostHog session when available;
- `trip_first_value_reached` was already reached;
- after returning, the user performs a useful action.

Useful actions:

- item created;
- item updated;
- item day changed;
- export completed;
- share completed;
- Plan or Budget opened during trip.

## Time relative to trip

Do not send exact dates.

For trip-scoped events send:

- `trip_phase`: `before | during | after | no_dates`;
- `days_until_trip_bucket`: `during | 1_3 | 4_7 | 8_30 | 31_plus | past | unknown`.

Rules:

- if today is before start date: bucket by days until trip starts;
- if today is between start and end: `during`;
- if today is after end date: `past`;
- if trip has no valid dates: `unknown`;
- exact dates stay local.

## Event dictionary

All events include the global properties from "Analytics versions" and safe context:

- `anon_user_id`;
- `session_id`;
- `display_mode`: `browser | pwa`;
- `screen`;
- `trip_count`;
- `item_count`;
- `days_count`;
- `currency`;
- `trip_id`, when trip-scoped;
- `item_id`, when item-scoped;
- `trip_origin`, when trip-scoped;
- `trip_phase`, when trip-scoped;
- `days_until_trip_bucket`, when trip-scoped.

### First layer

| Event | Meaning | Main properties | Send when | Once? |
| --- | --- | --- | --- | --- |
| `app_opened` | App was opened | `is_returning_user`, `last_open_days_ago`, `display_mode` | app start | no |
| `onboarding_started` | Onboarding shown | `onboarding_version`, `trigger: first_open | forced` | first onboarding screen appears | no |
| `onboarding_finished` | User left onboarding flow | `onboarding_version`, `outcome: completed | skipped | exited` | completed, skipped or exited onboarding | once per browser unless forced |
| `home_opened` | Zero screen opened | `trip_count` | home screen rendered | no |
| `trainer_opened` | Demo trainer opened | `trip_origin: demo`, `trainer_version` | trainer card opened | no |
| `trainer_action_completed` | User interacted with trainer | `action_type: item_updated | item_day_changed | section_opened`, `trainer_version` | meaningful trainer action completed | no |
| `trainer_cta_clicked` | User moved from trainer toward own trip | `trainer_version` | create-own-trip CTA clicked, when added | no |
| `trip_created` | User created own trip | `trip_id`, `trip_origin: user_created`, `creation_source: trainer | home | onboarding | empty_state | other`, `trip_count_after_create` | new trip created | no |
| `trip_opened` | Trip opened | `trip_origin`, `trip_phase`, `days_until_trip_bucket`, `has_custom_cover` | any trip opened | no |
| `trip_settings_opened` | Trip settings form opened | `trip_origin` | trip settings sheet opened | no |
| `trip_settings_updated` | Trip settings saved | `changed_fields`, `trip_origin`, `has_budget`, `has_dates` | trip settings form saved | no |
| `item_form_opened` | Item form opened | `trip_id`, `item_id` when edit, `mode: create | edit`, `item_type`, `item_status`, `trip_origin` | item form sheet opened | no |
| `item_created` | Item created | `trip_id`, `item_id`, `item_type`, `item_status`, `item_priority`, `has_date`, `has_time`, `has_price`, `has_paid_amount`, `has_link`, `has_note`, `trip_origin` | item form saved with new item | no |
| `item_updated` | Item updated | same as `item_created`, plus `changed_fields` if available | item form saved with existing item | no |
| `item_day_changed` | Item moved between day buckets | `trip_id`, `item_id`, `from`, `to`, `method: drag_desktop | drag_touch | form`, `item_type`, `trip_origin` | item date/bucket changes | no |
| `trip_section_opened` | Product section opened | `section: plan | basket | budget | currency`, `trip_origin` | user changes main tab | no |
| `feedback_channel_opened` | User opened feedback channel | `channel: telegram` | Telegram feedback link clicked | no |
| `trip_first_value_reached` | First value milestone | milestone properties above | threshold first reached | once per trip |
| `trip_working_plan_reached` | Working plan milestone | milestone properties above | threshold first reached | once per trip |

### Second layer

Add after first layer is stable, unless cheap to implement safely:

| Event | Meaning | Main properties | Send when | Once? |
| --- | --- | --- | --- | --- |
| `share_opened` | Share sheet opened | `trip_origin` | share UI opened | no |
| `share_method_selected` | User chose share path | `method: web_share | copy | telegram | other` | method selected | no |
| `share_completed` | Share finished | `method`, `result: success | fallback` | share completed | no |
| `export_started` | Export started | `export_type: plan | estimate`, `format: csv | pdf` | export chosen | no |
| `export_completed` | Export completed | `export_type`, `format` | download/preview completed | no |
| `export_failed` | Export failed | `export_type`, `format`, `reason_bucket` | export fails | no |
| `pwa_install_prompt_shown` | Browser install prompt became available | `display_mode` | `beforeinstallprompt` event fires | no |
| `pwa_install_clicked` | User clicked install | `prompt_available`, `already_installed` | install button clicked | no |
| `pwa_installed` | PWA installed | `display_mode` | browser `appinstalled` event fires | once per browser install |
| `trip_deleted` | User deleted trip | `trip_id`, `trip_origin` | user confirms deletion | no |
| `item_deleted` | User deleted item | `trip_id`, `item_id`, `item_type`, `item_status`, `trip_origin` | item deletion completed | no |
| `form_closed_without_save` | User abandoned a form | `form_type`, `mode`, `trip_origin` | sheet closes after changes without save | no |

## One-time events

These must be de-duplicated locally per trip:

- `trip_first_value_reached`;
- `trip_working_plan_reached`;
- future `trip_value_confirmed`.

Suggested local storage:

```js
backpacker.analytics.milestones.v1 = {
  [tripId]: {
    firstValue: "definition_version",
    workingPlan: "definition_version",
    valueConfirmed: "definition_version"
  }
}
```

If `definition_version` changes, milestones may be sent again with the new definition version only if we explicitly decide to re-baseline.

## Funnels

Do not use one mandatory linear funnel for all users.

### Onboarding

1. `app_opened`
2. `onboarding_started`
3. `onboarding_finished`
4. `home_opened`

### Trainer mechanics

1. `trainer_opened`
2. `trainer_action_completed`
3. `trainer_cta_clicked` or `trip_created`

### Own trip creation

1. `home_opened`
2. `trip_created`
3. `trip_settings_opened`
4. `trip_settings_updated`

### First value

1. `trip_created`
2. `item_created`
3. `trip_first_value_reached`

### Item form diagnostics

1. `item_form_opened`
2. `item_created`

### Working plan

1. `trip_first_value_reached`
2. repeated `item_created` / `item_updated`
3. `trip_section_opened`
4. `trip_working_plan_reached`

### Return to same trip

1. `trip_opened`
2. same trip opened in later session
3. useful action completed

### Before and during trip

Filter by:

- `trip_phase = before`;
- `trip_phase = during`;
- `days_until_trip_bucket`.

## Retention reports

Separate retention into:

- app return: user opens app again;
- same-trip return: same browser opens same user-created trip again;
- repeated useful action: item/action/export after previous useful action;
- before-trip usage: trip opened before dates;
- during-trip usage: trip opened during dates;
- next-trip creation: user creates a second user-created trip.

## Interpretation limits without backend

- `anon_user_id` identifies a browser profile, not guaranteed human identity.
- Same user on another device becomes a new user.
- Clearing localStorage resets identification.
- PWA and browser may appear as different contexts depending on platform.
- During-trip usage can only be detected on the device where the trip is stored.
- Without accounts, we cannot reliably join behavior across devices.
- Without backend, we cannot know whether a shared trip was opened by another person unless import/export or backend sharing is later added.

## Feature analytics — July observation release

Adds observation coverage for features that already shipped in product (`1.1.1.0` copy, `1.1.2.0` share/PDF) without changing UX or business logic. No new product features, no new milestones, no donation flow instrumentation.

### Schema migration strategy

- New schema version: `analytics_schema_version = 2026-07-01.1`.
- Previous version `2026-06-25.1` stays valid and is never deleted or rewritten.
- Core product-health metrics (first value, working plan, trainer, app opens) must keep counting events tagged with either schema version, so the weekly PostHog → Google Sheets sync does not lose data across the switch.
- Only the new feature events below are expected to appear exclusively under `2026-07-01.1`; do not backfill them into the old schema.
- PostHog dashboards/insights that hard-filter `analytics_schema_version = '2026-06-25.1'` must be updated to accept both values for core metrics.
- The Google Sheets integration reads an allow-list of schema versions (`ANALYTICS_SCHEMA_VERSIONS` Script Property, comma-separated; falls back to the single historical value when unset) instead of one exact string. No new feature columns are added to the sheet.

### `item_copy_opened`

- Product question: do people use copy to assemble similar plans faster, and where do they copy cards to?
- Sent when: the copy interface for an existing card actually opens (not on button hover/render, not on click if the sheet fails to open, not for the regular edit form).
- Scope: item-scoped.
- Properties: `trip_id`, `item_id` (source card), `trip_origin`, `item_type`, `item_status`, `source_bucket` (`day | undated`), `available_destination_scope` (`same_trip | other_trip | both`), plus the common safe context.
- Never sent: source title, date, note or any card content.
- Cardinality: once per copy-sheet open (no dedup — a user can open it many times).
- Metrics: unique users opening copy; completion rate against `item_created` with `creation_method=copy`; drop-off (`item_copy_opened` vs. `item_copy_cancelled`).

### `item_copy_cancelled`

- Product question: at what point do people abandon the copy flow?
- Sent when: the copy sheet is dismissed (backdrop, close button, browser back) without a confirmed copy.
- Scope: item-scoped. Properties: `trip_id`, `item_id`, `trip_origin`, `method`.
- Not a required event per the base spec, kept because it already existed in code (renamed from `card_copy_cancelled` for naming consistency) and answers a real drop-off question.

### `item_created` (extended)

- Added properties: `creation_method` (`manual | copy | other`, always required), `copy_destination_type` (`same_trip_other_day | same_trip_undated | other_trip_day | other_trip_undated`, only present when `creation_method = copy`).
- For copy, `trip_id`/`trip_origin`/`trip_phase`/`days_until_trip_bucket` refer to the **destination** trip, not the source.
- Historical events without `creation_method` must not be assumed to be manual creations in reports; only analyze `creation_method` breakdowns from `2026-07-01.1` onward.
- No separate `item_copy_completed` event exists; completion is read from `item_created` with `creation_method = copy`.

### `share_opened` (extended for trip context)

- Product question: how often do people start the "share trip" flow?
- Sent when: the "Поделиться поездкой" bottom sheet actually opens.
- Scope: trip-scoped. Added property: `share_context: trip` (the pre-existing app-share entry point keeps sending `share_opened` with `share_target: app` and no `share_context`; both coexist under the same event name, distinguished by these properties).
- Properties: `share_context`, `trip_id`, `trip_origin`, `trip_phase`, `days_until_trip_bucket`.

### `share_method_selected`

- Product question: which text-share channel does the device actually use?
- Sent when: the user confirms the "Отправить поездку текстом" action, at the moment the code determines whether the Web Share API is available (`method: web_share`) or not (`method: clipboard`).
- Scope: trip-scoped. Properties: `share_context: trip`, `share_format: text`, `method`, plus trip context.
- Not sent for the PDF path (PDF uses `export_started`/`export_completed`, see below).

### `share_completed` (extended for trip context)

- Product question: does the text/PDF share actually finish successfully?
- Sent when: Web Share Promise resolves, or clipboard write resolves, or (for PDF) the file share Promise resolves.
- Never sent on cancel (`AbortError`) or on a real API failure.
- Properties for trip text share: `share_context: trip`, `share_format: text`, `method` (`web_share | clipboard`), trip context.
- Properties for PDF share: `share_format: pdf`, `method: web_share`, trip context (no `share_context` needed — PDF is inherently trip-scoped).
- Limitation: this event does not prove the recipient read the message or opened the file — it only confirms the local share/clipboard mechanism completed.

### PDF export: `export_started` / `export_completed` / `export_failed` (`export_type = trip_pdf`)

- Product question: do people generate a trip PDF, does generation succeed, and how do they get it out (share vs. download)?
- `export_started`: sent once the user confirmed PDF creation and generation actually began. The trip PDF sheet has two explicit actions, "Скачать" and "Поделиться"; `delivery_method` (`download | share`) reflects which one the user pressed. Pressing "Поделиться" on a device without file Web Share support falls back to a download and reports `delivery_method: download` (checked synchronously via file-capability detection before generation starts).
- `export_completed`: sent once the PDF blob/document was actually built (independent of whether the user later cancels the OS share sheet). For `delivery_method = download` this means the download was initiated, not that the file was confirmed saved on device.
- `export_failed`: sent only on a real error. `failure_reason_bucket`: `generation` (PDF building failed), `browser` (pdf-lib module unavailable), `share_api` (the share step itself failed, excluding user cancel), `unsupported`, `unknown`.
- Shared properties: `export_type: trip_pdf`, `delivery_method`, `include_budget`, `include_notes`, `include_undated`, `options_changed`, `changed_options`, trip context.
- If the generated PDF is then shared successfully via the system share sheet, `share_completed` (`share_format: pdf`) is also sent (see above). Opening a print/preview dialog is not treated as a completed share.
- Cardinality: once per user-confirmed export attempt for each of started/completed/failed.

### PDF composition properties (`include_budget` / `include_notes` / `include_undated` / `options_changed` / `changed_options`)

- Sent only on `export_started` and `export_completed`, never as separate per-checkbox events.
- `changed_options` (`none | budget | notes | undated | multiple`) reflects the difference from the default configuration (budget on, notes off, undated on), not just the final checkbox state.
- Metrics must only use `export_completed` (successful) rows; a default-on option is not treated as a deliberate user choice.

### `item_form_reset`

- Product question: how often do people discard edits, and does that correlate with abandoning the card afterward?
- Sent only when all are true: form is in `mode=edit`, the form actually differs from the last saved card state, the user pressed reset, and the form was restored to the saved state.
- Never sent: on a disabled/no-op reset click, or when nothing changed.
- Properties: `trip_id`, `item_id`, `trip_origin`, `mode: edit`, `had_unsaved_changes: true`, `changed_fields_count`, `time_in_form_bucket` (`under_10s | 10_30s | 31_60s | over_60s`).
- Never sent: field values, before/after content.
- No `form_session_id` — reset-to-save/close sequencing is reconstructed from existing events plus timestamps.

### `trip_section_opened` (extended)

- Added property: `navigation_source` (`bottom_bar | internal_link | automatic | other`). Bottom nav clicks send `bottom_bar`; the internal auto-navigation before a (currently disabled) donation prompt sends `automatic`.
- Existing properties unchanged: `section`, `from_section`, trip context. Still sent only on an actual active-section change, not on re-renders.

### `home_opened` (extended)

- Added optional property `source`. Only `trip_bottom_bar` is currently sent, when the user taps the trip-header logo button to leave a trip back to the trips list. When triggered by onboarding completion or app startup, no `source` is sent.
- `home_opened` remains a global event: it must never receive `trip_id`, `trip_origin`, `trip_phase`, `days_until_trip_bucket` or `item_count`.

### `product_info_opened`

- Product question: do people look at the "О продукте" section, and is it mostly new or returning users?
- Sent when: the "О продукте" sheet actually opens (not on version text render).
- Scope: global. Properties: `entry_source` (only `home` exists today — the sole entry point is the home-screen support button), `is_returning_user` (captured once at app open, reused without re-reading storage). `app_version` is already present on every event via the common analytics context.
- This is a secondary feature metric; it must not be added to the main Product Health dashboard.

### Explicitly deferred / not tracked

- **Donation flow**: fully deferred. No `donation_offer_opened`, `donation_cta_clicked`, `donation_checkout_opened`, `donation_completed`, or amount properties are sent from production feature analytics while the flow stays behind `DONATION_FLOW_ENABLED = false`.
- **Disabled-button clicks**: not tracked, and not planned. Disabled affordances are verified through QA/accessibility/user testing, not telemetry.
- **Sticky edit-form buttons**: no dedicated event. Measured through the existing `item_form_opened` (`mode=edit`) → `item_updated` funnel; compare before/after via `app_version`/release boundary, and state the limitation explicitly if that boundary can't be reconstructed from historical data.
- **PDF download semantics**: `export_completed` with `delivery_method: download` means the download was initiated, not that the file was confirmed saved to the device.
- **Share completed semantics**: `share_completed` (text or PDF) never confirms that the recipient opened or read the shared content — only that the local share/clipboard mechanism finished successfully.

## Files to change during implementation

- `app.js`: event names, product properties, milestone detection, local de-duplication, trip phase buckets.
- `analytics-config.js`: schema/app version, environment flags, PostHog host/key, internal/test toggles.
- `index.html`: load config and optional release marker.
- `service-worker.js`: bump cache version when analytics files change.
- `ANALYTICS_PLAN.md`: update `analytics_schema_version` and `definition_version` when definitions change.

## Current implementation gap

The current code should be treated as a pre-schema implementation. Before serious reporting, align it with this document in a separate implementation slice:

- `app_open` -> `app_opened`;
- `onboarding_start` -> `onboarding_started`;
- `onboarding_done` -> `onboarding_finished`;
- `home_open` -> `home_opened`;
- `trainer_open` -> `trainer_opened`;
- `trip_create` -> `trip_created`;
- `trip_open` -> `trip_opened`;
- `trip_save` -> `trip_settings_updated`;
- `trip_sheet_open` -> `trip_settings_opened`;
- `item_sheet_open` -> `item_form_opened`;
- `item_create` -> `item_created`;
- `item_update` -> `item_updated`;
- `item_drag` -> `item_day_changed`;
- `view_change` -> `trip_section_opened`;
- `telegram_click` -> `feedback_channel_opened`.

Also remove separate `trip_open_before_trip`, `trip_open_during_trip`, `trip_open_after_trip` events and use `trip_opened` with `trip_phase`.
