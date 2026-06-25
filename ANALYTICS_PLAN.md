# Backpacker analytics plan

## Goal

Backpacker analytics should answer product questions, not collect personal travel data.

We want to understand:

- how many unique users open the app;
- how many users return;
- whether users create their own trips without help;
- whether users add, edit and move cards;
- whether users use the app during real trip dates;
- where users get stuck or abandon a flow;
- whether users download, share or ask for help.

## Tool split

- PostHog: product behavior, funnels, retention, paths and events.
- Google Sheet via Telegram bot: qualitative feedback from testers.

Google Sheet is not the source of product analytics because high-volume click events will quickly turn it into noise.

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
- any free-text field.

Safe properties:

- anonymous user id;
- session id;
- current screen;
- PWA/browser mode;
- trip count;
- item count;
- day count;
- currency code;
- booleans like has budget, has dates, has custom cover;
- event type/status/priority as controlled enum values;
- source and target buckets such as day/undated.

## Core events

- app_open
- return_next_day
- onboarding_start
- onboarding_slide
- onboarding_done
- home_open
- trainer_open
- trip_create
- trip_open
- trip_save
- trip_open_before_trip
- trip_open_during_trip
- trip_open_after_trip
- trip_sheet_open
- trip_cover_update
- item_sheet_open
- item_create
- item_update
- item_delete
- item_drag
- view_change
- share_sheet_open
- download_estimate
- download_plan
- share_app
- share_trip
- telegram_click
- pwa_install_click
- pwa_install_choice
- pwa_installed
- currency_rates_refresh
- external_link_open
- trainer_reset

## First funnels

### Activation

1. app_open
2. onboarding_done
3. home_open
4. trip_create
5. trip_save
6. item_create
7. item_drag
8. download_plan / share_trip / telegram_click

### Trainer to own trip

1. app_open
2. trainer_open
3. item_update / item_drag
4. trip_create

### In-trip usage

1. trip_create
2. trip_save with dates
3. trip_open_before_trip
4. trip_open_during_trip
5. item_update / view_change / download_plan during trip

## Interpretation notes

- If many users open the trainer but do not create trips, the zero screen or trainer call-to-action is unclear.
- If users create trips but do not add cards, the add flow is unclear or intimidating.
- If users open item sheets but do not save, form fields may be too heavy.
- If users do not drag cards, drag affordance may be hidden.
- If users use budget but not plan, Backpacker may be more of a travel cost basket than an itinerary planner.
- If users open during trip dates, the app has a chance to become an actual travel companion, not just a planning toy.
