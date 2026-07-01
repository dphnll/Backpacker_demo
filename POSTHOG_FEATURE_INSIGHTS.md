# Backpacker — Feature Adoption dashboard (PostHog setup)

No programmatic PostHog access was available in this session, so nothing was created automatically. This is a manual, step-by-step setup guide for a human with PostHog EU access (project `209981`, host `https://eu.posthog.com`) to build the dashboard.

Do not create these insights until the corresponding production payloads have been verified (see the final report's "Проверка раскрытых payload" section). Create insights only after confirming events actually arrive with the expected properties.

## Global rules for every insight below

Apply these filters to every insight in this dashboard, unless a step says otherwise:

- `environment = production`
- `is_internal_user = false`
- `is_test_user = false`
- `analytics_schema_version = 2026-07-01.1` — **exact match, not "is set"**. All events in this dashboard are new in this release and never existed under `2026-06-25.1`, so there is nothing to include from the old schema here. (This differs from the core Product Health dashboard, which must accept both schema versions.)

Do not add this dashboard's insights to the main **Product Health** dashboard. Create a separate dashboard named **`Backpacker — Feature Adoption`** and add every insight below to it.

## 1. Copy adoption

**Insight A — Copy funnel (Funnel)**

1. New Insight → Funnel.
2. Step 1: event `item_copy_opened`.
3. Step 2: event `item_created`, filter `creation_method = copy`.
4. Conversion window: 1 day (copy is a same-session action).
5. Apply global filters.
6. Save as **"Copy: open → completed"**.

**Insight B — Copy destination breakdown (Trends)**

1. New Insight → Trends.
2. Series: event `item_created`, filter `creation_method = copy`, aggregation = unique users (or total count for "copies per user" view — build both if useful).
3. Breakdown by property `copy_destination_type`.
4. Apply global filters.
5. Save as **"Copy: destination breakdown"**.

**Insight C — Unique copy users (Trends)**

1. New Insight → Trends, weekly.
2. Series: event `item_copy_opened`, unique users.
3. Apply global filters.
4. Save as **"Copy: unique users opening the flow"**.

Note: `item_copy_opened / item_created(creation_method=copy)` completion rate is read off Insight A's funnel conversion %, not computed manually.

## 2. Text share funnel

**Insight D — Trip text share funnel (Funnel)**

1. New Insight → Funnel.
2. Step 1: event `share_opened`, filter `share_context = trip`.
3. Step 2: event `share_method_selected`, filter `share_format = text`.
4. Step 3: event `share_completed`, filter `share_format = text`.
5. Conversion window: 1 day.
6. Apply global filters.
7. Save as **"Trip text share funnel"**.

**Insight E — Text share method breakdown (Trends)**

1. New Insight → Trends.
2. Series: event `share_completed`, filter `share_format = text`.
3. Breakdown by property `method`.
4. Apply global filters.
5. Save as **"Text share: method breakdown"**.

## 3. PDF funnel

**Insight F — Trip PDF funnel (Funnel)**

1. New Insight → Funnel.
2. Step 1: event `export_started`, filter `export_type = trip_pdf`.
3. Step 2: event `export_completed`, filter `export_type = trip_pdf`.
4. Conversion window: 2 minutes (PDF generation can take a few seconds on slow devices; keep it short but not instant).
5. Apply global filters.
6. Save as **"Trip PDF: start → generated"**.

**Insight G — PDF failures (Trends)**

1. New Insight → Trends.
2. Series: event `export_failed`, filter `export_type = trip_pdf`.
3. Breakdown by property `failure_reason_bucket`.
4. Apply global filters.
5. Save as **"Trip PDF: failures by reason"**.

**Insight H — PDF delivery method breakdown (Trends)**

1. New Insight → Trends.
2. Series: event `export_completed`, filter `export_type = trip_pdf`.
3. Breakdown by property `delivery_method`.
4. Apply global filters.
5. Save as **"Trip PDF: delivery method breakdown"**.

## 4. PDF composition

Only count successful exports — always filter on `export_completed`, never `export_started`.

**Insight I — PDF composition breakdown (Trends, 4 series or 4 saved insights)**

1. New Insight → Trends.
2. Series: event `export_completed`, filter `export_type = trip_pdf`.
3. Breakdown by property `changed_options`.
4. Apply global filters.
5. Save as **"Trip PDF: changed options"**.
6. Optionally add three more single-property Trends (or use PostHog's multi-breakdown, if available on the plan) for `include_budget`, `include_notes`, `include_undated` as boolean breakdowns, each filtered to `export_completed` / `export_type = trip_pdf`.

Remember: a default-on option (e.g. `include_budget = true` when the user never touched it) is not a deliberate choice — read `changed_options` before interpreting the raw boolean breakdowns.

## 5. Edit completion

**Insight J — Edit completion funnel (Funnel)**

1. New Insight → Funnel.
2. Step 1: event `item_form_opened`, filter `mode = edit`.
3. Step 2: event `item_updated`.
4. Conversion window: 30 minutes (people may sit on an edit form).
5. Breakdown by `app_version` (or `release_id` if that becomes the standard) to compare before/after the sticky-buttons release.
6. Apply global filters — **except** `analytics_schema_version`: for this specific insight, allow both `2026-06-25.1` and `2026-07-01.1`, since `item_form_opened`/`item_updated` already existed before this release and the whole point is a before/after comparison across the version boundary.
7. Save as **"Edit form completion by app version"**.

If the app-version boundary cannot be reliably reconstructed from historical data (e.g. old events don't carry `app_version`), note that limitation directly on the insight and restrict the comparison to versions where `app_version` is present.

## 6. Reset usage

**Insight K — Reset usage (Trends)**

1. New Insight → Trends.
2. Series 1: event `item_form_reset`, unique users.
3. Series 2: event `item_form_reset`, total count.
4. Apply global filters.
5. Save as **"Reset: unique users and event count"**.

**Insight L — Reset ratio to edit opens (Trends, formula)**

1. New Insight → Trends.
2. Series A: event `item_form_reset`.
3. Series B: event `item_form_opened`, filter `mode = edit`.
4. Use the formula editor: `A / B`.
5. Apply global filters.
6. Save as **"Reset ratio vs. edit form opens"**.

## 7. Navigation usage

**Insight M — Bottom bar navigation breakdown (Trends)**

1. New Insight → Trends.
2. Series: event `trip_section_opened`.
3. Breakdown by `navigation_source`, then a second view breakdown by `section`.
4. Apply global filters.
5. Save as **"Navigation: source and section breakdown"**.

**Insight N — Return to home from trip (Trends)**

1. New Insight → Trends.
2. Series: event `home_opened`, filter `source = trip_bottom_bar`.
3. Apply global filters — **except** `is_internal_user`/`is_test_user`/`environment` still apply, but `home_opened` is a global event and never carries `analytics_schema_version`-dependent trip properties; that's fine, the schema filter still applies to the event envelope itself.
4. Save as **"Return-to-home from trip"**.

Do not interpret a rise in section switches automatically as a UX improvement — it may also indicate confusion.

## 8. Product info

**Insight O — Product info opens (Trends)**

1. New Insight → Trends, weekly trend.
2. Series: event `product_info_opened`, unique users and total count (two series).
3. Apply global filters.
4. Save as **"Product info: opens over time"**.

**Insight P — Product info by entry source and user type (Trends)**

1. New Insight → Trends.
2. Series: event `product_info_opened`.
3. Breakdown by `entry_source`, then a second view breakdown by `is_returning_user`.
4. Apply global filters.
5. Save as **"Product info: entry source / returning vs. new"**.

Add this dashboard's insights under **`Backpacker — Feature Adoption`**, not the main Product Health dashboard — this is explicitly a secondary set of feature metrics.
