# PostHog → Google Sheets metrics sync

Aggregated weekly product metrics from PostHog into the `PostHog_метрики` sheet.

## Target spreadsheet

`Backpacker Research` — ID `1jQsMqIkejdyxpD7mHI2IqwViAXUTNVFqqJXRiFM17Hk`

Sheets touched: **only `PostHog_метрики`** (created on first sync if absent).  
Sheets not touched: `Участники`, `Наблюдения`, `Фидбэк`, `feedback TG`.

## Files

| File | Purpose |
|---|---|
| `posthog_metrics_sync.gs` | Main Apps Script — paste into the spreadsheet's bound script |
| `posthog_metrics_sync_tests.gs` | Pure-function tests — paste alongside, run `runAllTests()` |

## Setup (one-time)

### 1. Open the Apps Script editor

Spreadsheet → **Extensions → Apps Script**.

### 2. Paste both `.gs` files

Create two files in the editor (or paste into existing files).  
Name them as the filenames above.

### 3. Set Script Properties

**Extensions → Apps Script → Project Settings → Script Properties → Add property**

| Property | Value |
|---|---|
| `POSTHOG_PERSONAL_API_KEY` | Your personal API key — starts with `phx_...` |
| `POSTHOG_PROJECT_ID` | Numeric project ID (visible in the PostHog URL: `/project/12345/…`) |
| `POSTHOG_HOST` | *(optional)* Default: `https://eu.posthog.com` |

**Important:** Use a **Personal API key** (`phx_...`), not the project capture key (`phc_...`).  
The capture key is public and used by the app. The personal key is private and used only here.

To create a personal API key: PostHog → top-right avatar → **Personal API keys → Create key**.  
Required scope: `Query Read` (or full access).

### 4. Run tests

In the Apps Script editor, open `posthog_metrics_sync_tests.gs`, select `runAllTests`, click **▶ Run**.  
All tests should pass before the first live sync.

### 5. Test the connection

Reload the spreadsheet. Use the **PostHog Sync** menu → **Test PostHog connection**.

### 6. Preview before writing

**PostHog Sync → Preview sync** — shows all metric values for the previous ISO week without writing anything.

### 7. First real sync

**PostHog Sync → Sync metrics now**.

### 8. Install daily trigger

**PostHog Sync → Install daily trigger** — runs automatically at 07:00 every day.  
The trigger is idempotent: re-syncing the same period updates the existing row instead of appending.

## Metrics collected

| Column | Description |
|---|---|
| `period_start` | ISO week Monday (inclusive) |
| `period_end` | ISO week Monday of next week (exclusive) |
| `period_label` | Human-readable range, e.g. `2026-06-19 – 2026-06-25` |
| `synced_at` | Timestamp of last sync |
| `new_anon_users` | Distinct users with `app_opened` + `is_returning_user=false` |
| `first_value_funnel_started` | Users with `trip_created` (user_created) in period |
| `first_value_funnel_completed` | Users with `trip_first_value_reached` in period |
| `first_value_conversion_7d_pct` | % of starters who reached first_value by end+7d |
| `working_plan_funnel_started` | = `first_value_funnel_completed` (started = reached first_value) |
| `working_plan_funnel_completed` | Users with `trip_working_plan_reached` in period |
| `working_plan_conversion_14d_pct` | % of first_value users who reached working_plan by end+14d |
| `trainer_users` | Users with `trainer_opened` in period |
| `trainer_action_users` | Users with `trainer_action_completed` in period |
| `trainer_to_own_trip_7d` | Trainer users who created a user trip within 7d |
| `users_trip_first_value_reached` | = `first_value_funnel_completed` |
| `users_trip_working_plan_reached` | = `working_plan_funnel_completed` |
| `app_versions` | Comma-separated distinct `app_version` values in period |
| `main_observation` | **Manual** — preserved on re-sync |
| `main_problem` | **Manual** — preserved on re-sync |
| `decision_for_next_week` | **Manual** — preserved on re-sync |

## Filters applied to all metrics

- `environment = production`
- `is_internal_user = false`
- `is_test_user = false`
- `analytics_schema_version = 2026-06-25.1`

## Data privacy

- No raw events are written to the sheet.
- `anon_user_id`, `session_id`, `trip_id`, `item_id` are never written.
- `distinct_id` is used only as a SQL grouping key inside PostHog queries; it is never returned or stored.
- The Authorization header is never logged.
- `app_versions` contains only the controlled `app_version` string from `analytics-config.js`.

## Idempotency

Each row is keyed by `(period_start, period_end)`.  
Re-running sync for the same period updates the existing row.  
Manual columns (`main_observation`, `main_problem`, `decision_for_next_week`) are preserved on update.

## Error handling

| Error | Behavior |
|---|---|
| Missing Script Properties | Alert with exact property name(s) and setup instructions |
| PostHog 401 | Alert: check `POSTHOG_PERSONAL_API_KEY`, use `phx_` not `phc_` |
| PostHog 403 | Alert: key does not have access to the configured project |
| PostHog 429 | Alert: rate limited, wait and retry |
| PostHog 500 | Alert: server error, try later |
| Network timeout | Alert: timeout or DNS error |
| Empty results | Metric defaults to `0`, sync continues |

## Smoke test

1. Set Script Properties with valid credentials.
2. Run `runAllTests()` — all green.
3. Run **Test PostHog connection** — "Connection OK".
4. Run **Preview sync** — values appear in alert, nothing written.
5. Run **Sync metrics now** — row appears in `PostHog_метрики`.
6. Run **Sync metrics now** again — same row updated, `synced_at` changes, row count stays the same.
7. Enter text in `main_observation`, run sync again — text is preserved.
