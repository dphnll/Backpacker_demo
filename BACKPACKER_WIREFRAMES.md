# Backpacker: mobile-first wireframes

## Wireframe principle

Backpacker is designed mobile-first.

The first version should feel like a compact travel control panel in the user's pocket, not like a desktop planning spreadsheet squeezed onto a phone.

Visual direction:
- tile-based mobile UI;
- large obvious tappable blocks;
- friendly icon-like visual language;
- light, playful travel mood;
- colorful but still readable;
- closer to a pocket travel dashboard than to a corporate planner.

Reference mood:
- simple square/rectangular tiles;
- clear pictograms for ticket, hotel, food, transport, places, budget;
- cheerful colors;
- intuitive "tap the tile" feeling.

Do not copy stock illustrations directly. Use the vibe and UI principle, not the exact artwork.

Primary user mode:
- planning on a phone;
- checking the plan while moving;
- quickly adding ideas from links/chats/sites;
- changing decisions without rebuilding the whole trip.

Desktop can show the same blocks wider, but it is secondary.

## Core navigation

MVP can use 4 bottom tabs:

1. Plan
2. Basket
3. Budget
4. Share

Alternative: 3 tabs if we want even tighter MVP:

1. Plan
2. Basket
3. Budget

Share can live as a button in the header.

CTO preference for first build:
- use 3 tabs: Plan / Basket / Budget;
- put Share in the trip header;
- keep one primary floating action button: Add.

## Current mobile wireframes — 1.1.2.42

These wireframes describe the current public shape after Cloud Ideas UI foundation. They extend the original MVP notes below without rewriting the historical first-build baseline.

### Home

```text
------------------------------------------------+
| [logo] BACKPACKER                         share|
|        [profile / display name entry]          |
+------------------------------------------------+
| [Trainer trip]                                 |
+------------------------------------------------+
| [Create new trip]                              |
| Manual or AI draft                             |
+------------------------------------------------+
| [Ideas]                                        |
| Places, links and wanted ideas before a trip   |
+------------------------------------------------+
| My trips                                       |
| [Trip card] [Trip card]                        |
+------------------------------------------------+
| Shared with me                                 |
| [Received read-only trip card]                 |
+------------------------------------------------+
```

Rules:

- profile entry opens the same profile/recoverable access sheet;
- `Ideas` is a first-class home entry, separate from personal trips;
- local personal trips and server-side received/ideas data remain visually separate;
- share button in the home header shares Backpacker itself, not a trip snapshot.

### Ideas screen

```text
------------------------------------------------+
| ←  Ideas                                Add    |
|    Places, links and wanted ideas before trip  |
+------------------------------------------------+
| [Все идеи] [Без подборки] [Грузия] [Бани]      |
+------------------------------------------------+
| [thumb/icon] Title                             |
|              Type · Collection                 |
|              Location · price · есть ссылка    |
|              notes/excerpt preview             |
+------------------------------------------------+
```

States:

- loading: `Загружаем идеи...`;
- empty all: `Пока нет идей` + actions `Добавить идею` / `Создать подборку`;
- empty collection: collection-specific empty card;
- error: readable error with retry and add action.

Collection chips:

- `Все идеи` is a view;
- `Без подборки` means `collection_id = null`;
- named collections come from `travel_idea_collections`.

Idea cards:

- optional thumbnail if image metadata is present;
- fallback icon by semantic type;
- title, type, collection, optional location, price and link marker;
- notes/excerpt preview if available.

### Idea form

```text
------------------------------------------------+
| Add/Edit idea                              X   |
+------------------------------------------------+
| Title                                          |
| Type                                           |
| Collection                                     |
| [New collection]                               |
| URL                                            |
| Location                                       |
| Price                  Currency               |
| Notes / description                            |
|                                                |
| [Save]                         [Archive*]      |
------------------------------------------------+
```

Rules:

- title is required;
- collection is optional;
- archive is visible only for an existing idea;
- technical fields are not shown: owner id, source, status, image source, timestamps;
- no current `Добавить в поездку` action yet;
- no Extension UI, source identifiers UI, rename/delete collection, recommendations or map in this release.

## Screen 1: Trip home / Plan

Purpose:
The user opens Backpacker and immediately understands what is happening with the trip today and across the next days.

Mobile layout:

```text
------------------------------------------------+
| Backpacker                                    |
| Казань, 12-15 июля                       Share |
| 4 дня · бюджет 45 000 ₽                       |
+------------------------------------------------+
| Paid 18 500 ₽ | Planned 30 500 ₽ | Left 14 500 |
+------------------------------------------------+
| [ + Add item ]                                |
+------------------------------------------------+
| Today / Day 1                                 |
| 12 июля · сб                                  |
|                                                |
| 09:30  Train / flight arrival       paid       |
| 12:00  Check-in / leave bags        fixed      |
| 18:00  Dinner place                 want       |
|                                                |
| Day total: 6 500 ₽                            |
+------------------------------------------------+
| Day 2                                         |
| 13 июля · вс                                  |
|                                                |
| 10:00  Walking tour                 fixed      |
| 16:00  Bath / spa                   want       |
|                                                |
| Day total: 8 000 ₽                            |
+------------------------------------------------+
| Day 3                                         |
| ...                                           |
+------------------------------------------------+
| Unscheduled: 7 ideas                          |
| Museum · Coffee · River walk · Market         |
+------------------------------------------------+
| Plan        Basket        Budget              |
+------------------------------------------------+
```

Key elements:
- sticky trip header;
- compact budget strip;
- primary add action;
- day cards;
- unscheduled preview;
- bottom navigation.

Important:
- day cards should not feel like a strict calendar;
- items can exist without exact time;
- exact time is optional;
- "Unscheduled" must be visible on the plan screen.

## Screen 2: Quick add item

Purpose:
Fast capture of a trip fragment before the user loses it.

This should be a bottom sheet on mobile.

```text
-------------------------------------+
| Add to trip                    X   |
+-------------------------------------+
| Title                               |
| [ Museum of something           ]   |
|                                     |
| Type                                |
| [ ticket ] [ food ] [ place ]       |
| [ excursion ] [ spa ] [ transport ] |
|                                     |
| Status                              |
| [ paid ] [ fixed ] [ want ] [ maybe]|
|                                     |
| Day                                 |
| [ No date yet v ]                   |
|                                     |
| Time        Duration                |
| [ --:-- ]   [ 90 min ]              |
|                                     |
| Price       Paid                    |
| [ 1500 ]    [ 0 ]                   |
|                                     |
| Link                                |
| [ https://...                    ]  |
|                                     |
| Note                                |
| [ free text                      ]  |
|                                     |
| [ Save item ]                       |
-------------------------------------+
```

MVP simplification:
- no required fields except title;
- type defaults to "idea";
- status defaults to "want";
- day defaults to "No date yet".

## Screen 3: Edit item

Purpose:
Change status/date/price quickly.

Can reuse the same bottom sheet as add item.

Fast actions at the top:

```text
[ Mark paid ] [ Move day ] [ Skip ]
```

Important:
- changing day should be one tap + selection;
- changing status should not require opening many nested menus;
- delete should exist but be visually secondary.

## Screen 4: Basket

Purpose:
Show all trip pieces grouped by state, not by day.

Mobile layout:

```text
------------------------------------------------+
| Basket                                    Add |
+------------------------------------------------+
| Fixed / booked                                |
| - Hotel · 18 000 ₽ · 12-15 Jul                |
| - Train tickets · 7 500 ₽ · paid              |
+------------------------------------------------+
| Want                                          |
| - Bath / spa · 3 500 ₽ · no date              |
| - Local food tour · 4 000 ₽ · Day 2           |
+------------------------------------------------+
| Maybe                                         |
| - Museum · 1 200 ₽                            |
| - Market walk · free                          |
+------------------------------------------------+
| Backup                                        |
| - Alternative dinner place                    |
+------------------------------------------------+
| Skipped                                       |
| - Expensive excursion                         |
+------------------------------------------------+
```

Filters:
- all;
- no date;
- paid;
- want;
- maybe;
- backup.

MVP:
- use simple filter chips;
- no complex search unless it is very cheap.

## Screen 5: Budget

Purpose:
Make the financial picture obvious.

Mobile layout:

```text
------------------------------------------------+
| Budget                                        |
+------------------------------------------------+
| Budget limit                                  |
| 45 000 ₽                                      |
+------------------------------------------------+
| Paid already                                  |
| 18 500 ₽                                      |
+------------------------------------------------+
| Fixed planned                                 |
| 24 000 ₽                                      |
+------------------------------------------------+
| Optional / want                               |
| 6 500 ₽                                       |
+------------------------------------------------+
| Possible total                                |
| 30 500 ₽                                      |
+------------------------------------------------+
| Remaining                                     |
| 14 500 ₽                                      |
+------------------------------------------------+
| By day                                        |
| Day 1 · 6 500 ₽                               |
| Day 2 · 8 000 ₽                               |
| Day 3 · 9 000 ₽                               |
| Day 4 · 7 000 ₽                               |
+------------------------------------------------+
```

Below the cards, MVP must also provide a table-like estimate view.

This is not a pretty event card layout. It is the "Excel brain" view: events, links and prices in one scannable table.

```text
------------------------------------------------+
| Estimate table                       Copy      |
+------------------------------------------------+
| Event        | Day   | Status | Price | Link   |
| Flight       | Day 1 | paid   | 7500  | open   |
| Tripster     | Day 2 | want   | 4000  | open   |
| Dinner       | no day| maybe  | 2500  | open   |
------------------------------------------------+
```

Important:
- every item can have a source / booking link;
- links should be clickable from item cards and from the estimate table;
- "Copy table" should produce TSV/plain text that can be pasted into Excel or Google Sheets.

Visual rules:
- paid should feel calm and done;
- over-budget should be clearly visible;
- backup/skipped should not inflate the main total.

## Screen 6: Share trip

Purpose:
Send the trip to a friend without accounts/collaboration.

MVP should not do shared editing.

Share options:
- copy Telegram-friendly text;
- copy compact summary;
- later: generate read-only web page.

Mobile layout:

```text
------------------------------------------------+
| Share trip                                    |
+------------------------------------------------+
| [ Copy summary ]                              |
| [ Copy day-by-day plan ]                      |
+------------------------------------------------+
| Preview                                       |
| Backpacker: Казань, 12-15 июля                |
|                                                |
| Budget:                                       |
| Paid: 18 500 ₽                                |
| Planned: 30 500 ₽                             |
|                                                |
| Day 1                                         |
| - Train / flight arrival                      |
| - Check-in                                    |
| - Dinner                                      |
|                                                |
| No date yet                                   |
| - Museum                                      |
| - Coffee                                      |
------------------------------------------------+
```

## Screen 7: Trip setup

Purpose:
Create or edit trip context.

This can be a full screen or modal.

```text
------------------------------------------------+
| Trip settings                              X  |
+------------------------------------------------+
| Trip name                                     |
| [ Kazan solo trip                         ]   |
| Destination                                   |
| [ Kazan                                  ]    |
| Dates                                         |
| [ 12.07.2026 ] [ 15.07.2026 ]                 |
| Currency                                      |
| [ RUB v ]                                     |
| Budget                                        |
| [ 45000 ]                                     |
| Preferences                                   |
| [ slow mornings, food, spa, one excursion... ]|
|                                                |
| [ Save trip ]                                 |
------------------------------------------------+
```

MVP:
- one active trip is enough;
- later we can add trip list/archive.

## Component states

### Item card

Compact item card:

```text
| 10:00 Walking tour                fixed |
| 2h · 4 000 ₽ · open link                |
```

Without time:

```text
| Bath / spa                         want |
| no time · 3 500 ₽                        |
```

Without day:

```text
| Museum                             maybe |
| no date · 1 200 ₽                        |
```

### Status colors

Keep colors restrained.

Suggested:
- paid: calm green;
- fixed/booked: graphite/dark;
- want: blue or teal;
- maybe: muted gray;
- backup: soft amber;
- skipped: low-contrast gray.

Avoid:
- too many bright colors;
- travel-agency visual noise;
- decorative maps/photos in MVP.

## Desktop adaptation

Desktop can use 3 columns:

```text
---------------------------------------------------------
| Trip header + budget summary                          |
---------------------------------------------------------
| Basket / quick add | Plan by days       | Unscheduled |
|                    |                    |             |
---------------------------------------------------------
```

But desktop must not drive the product.

If there is a conflict between desktop elegance and mobile usefulness, choose mobile usefulness.

## First build priority

Build in this order:

1. Data model and localStorage.
2. Trip settings.
3. Add/edit item bottom sheet.
4. Plan by days.
5. Basket grouped by status.
6. Budget summary.
7. Estimate table with clickable links and copy-to-table text.
8. Share text generation.
9. Mobile polish.
10. Desktop adaptation.

## Non-negotiables for first test

- It must be usable from a phone.
- Add item must be fast.
- Items without dates must be easy to see.
- Budget must update instantly.
- Source / booking links must be clickable.
- There must be a plain table-like estimate view.
- Share summary must produce a useful text.
- No backend.
- No login.
- No maps.
- No AI planning in the first build.

## Later: mobile link capture

Future improvement:
Allow adding an item from a mobile browser/share flow.

Reference behavior:
Recipe apps like My Recipe Box can take a recipe page from the browser and create a recipe card. Backpacker could eventually do the same for:
- Aviasales ticket options;
- Tripster excursions;
- restaurant pages;
- hotel pages;
- spa/bath pages;
- any interesting place.

Not in the first MVP:
- automatic parsing;
- browser extension;
- native share target;
- reliable extraction from arbitrary websites.

MVP now:
- manual link field;
- visible clickable links;
- table view with links and prices.
