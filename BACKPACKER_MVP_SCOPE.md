# Backpacker: MVP scope

## Working name

Backpacker

## Repositories

Main development repository:
https://github.com/dphnll/Backpacker

Public demo repository:
https://github.com/dphnll/Backpacker_demo

Repository policy:
- Backpacker is a separate product and must not use DocGen / DocGen-demo repositories.
- Main implementation goes to `dphnll/Backpacker`.
- Public demo build goes to `dphnll/Backpacker_demo`.
- Public demo should be updated only after the local/main version is reviewed and approved by Irina.
- The demo repository can be used for GitHub Pages if the project remains a static frontend.

## Product idea

Backpacker is a personal trip basket for an independent traveler.

It is not a travel marketplace, not a booking service, not a full itinerary generator, and not a superapp.

The first version helps one traveler collect all trip pieces in one place: tickets, accommodation, excursions, food spots, bath/spa plans, transport, links, prices, notes, and ideas. Then it helps lay them out across 3-4 travel days and understand what is already fixed, what is optional, what is still unscheduled, and how the budget is changing.

## Core user

Primary user for MVP: Irina, independent traveler planning a short solo trip for 3-4 days.

User style:
- travels independently;
- buys tickets/accommodation herself;
- wants flexibility, not a rigid tour plan;
- likes a mix of planned activities and spontaneous options;
- wants to combine normal tourist things with personal preferences like food, baths, unusual places, quiet time, and logistics;
- does not want to assemble the trip from scattered chats, notes, links, screenshots, and browser tabs.

## Core pain

The painful moment starts when the trip becomes real:
- tickets are being bought;
- accommodation is being chosen or booked;
- excursions and places are being considered;
- food/places/logistics need to be connected;
- the rough budget needs to be understood;
- some things are fixed, some are just ideas, some are alternatives.

There is no single convenient place where the traveler can put all trip fragments and see:
- what is already bought;
- what is being considered;
- what day it belongs to;
- what is not scheduled yet;
- how much the trip already costs;
- how much it may cost if all desired options are added;
- whether a day is overloaded;
- whether there are gaps or conflicts.

## MVP hypothesis

If Irina can put all trip pieces into one flexible trip basket and quickly distribute them across days, then she will feel more in control, spend less time switching between notes/tabs/chats, and actually use the tool during planning and on the trip.

## MVP formula

Create a trip, add all items into a basket, distribute them across days, and see budget/status/unscheduled items at a glance.

## First use case

Trip: short solo trip for 3-4 days.

Goal: plan the trip enough to make decisions and use it in real life.

Success condition:
- Irina can enter 15-25 trip items in 20-30 minutes;
- she sees fixed bookings, optional ideas, and unscheduled items;
- she sees budget totals;
- she can move items between days/statuses;
- during the trip she opens Backpacker instead of returning to scattered notes.

## MVP screens

### 1. Trip setup

Purpose: create the context for one trip.

Fields:
- trip name;
- destination;
- start date;
- end date;
- number of days;
- currency;
- rough budget limit;
- travel style / preferences.

Travel preferences can be simple free text in MVP:
- food preferences;
- activity preferences;
- rest style;
- pace;
- must-have rituals;
- things to avoid.

Example:
> I travel alone, like slow mornings, local food, baths/spa, one meaningful excursion per day, not too many museums, and enough time to walk without rushing.

### 2. Trip basket

Purpose: collect all trip pieces before they are perfectly scheduled.

Item types:
- ticket;
- accommodation;
- transport;
- excursion;
- food;
- place;
- bath/spa/rest;
- shopping;
- idea;
- other.

Item fields:
- title;
- type;
- status;
- date or no date yet;
- start time;
- duration;
- price;
- paid amount;
- link;
- source / booking link for payment or reservation;
- address/location text;
- note;
- priority.

Statuses:
- fixed / booked;
- paid;
- want;
- maybe;
- backup;
- skipped.

Priority:
- must;
- nice;
- optional.

### 3. Plan by days

Purpose: turn the basket into a flexible day-by-day trip plan.

For each day:
- date;
- list of scheduled items;
- day total;
- paid total;
- planned total;
- number of fixed items;
- number of optional items.

Required actions:
- move item to another day;
- remove date and return item to unscheduled;
- change status;
- edit item;
- duplicate item;
- delete item.

MVP can use simple controls instead of drag-and-drop:
- dropdown for day;
- dropdown for status;
- edit modal or inline edit.

### 4. Unscheduled items

Purpose: keep ideas visible even before they fit into the plan.

This is important because the user should not lose interesting places just because they are not assigned to a specific day yet.

The unscheduled block should show:
- title;
- type;
- price;
- priority;
- note/link;
- quick assign to day.

### 5. Budget summary

Purpose: show whether the trip is financially clear.

Summary:
- budget limit;
- paid already;
- fixed planned total;
- optional planned total;
- total if all active items are included;
- remaining budget.
- table-like estimate with events, statuses, prices and clickable links.

MVP rules:
- skipped items do not count;
- backup items can be shown separately;
- paid/fixed/want/maybe should be visually distinct.

### 6. Trip dashboard

The first usable screen can combine:
- header with trip name/dates/budget;
- budget summary;
- quick add item;
- day columns;
- unscheduled basket.

The first version should prioritize function over beauty, but still feel clean and calm.

## UX principles

- One trip = one working surface.
- Do not force the user to plan everything perfectly.
- Unscheduled items are first-class citizens.
- Budget must be visible without opening reports.
- The user should be able to change plans quickly.
- The app should help with flexible control, not pressure the user into a rigid itinerary.
- Mobile first. The product should be comfortable on a phone before it is polished for desktop.
- Desktop can exist as a wider version of the same core flow, but it is not the primary design target.
- Telegram Mini App is an acceptable implementation direction if it helps the user open the tool quickly during planning and during the trip.
- The app may be used in unstable contexts: on the move, in transport, between bookings, during a walk, with partial attention.

## What the MVP must do

Must-have:
- create/edit one trip;
- add/edit/delete trip items;
- assign items to days or leave unscheduled;
- change item status;
- show budget totals;
- show paid vs planned;
- show day-by-day plan;
- save data locally in browser;
- work without backend for the first personal test.

Should-have:
- quick add item form;
- item type chips/icons;
- simple filters by status/type;
- notes and links clickable;
- export or copy summary text.
- share trip with a friend as a readable summary.
- budget table mode: event / day / status / price / paid / link.

Could-have later:
- AI suggestions based on preferences;
- import from email/PDF/screenshots;
- mobile share/import flow from browser links into Backpacker, similar to saving a recipe from a website into a recipe box app;
- maps;
- route timing;
- collaborative planning / shared editing;
- mobile PWA;
- cloud sync;
- accounts;
- public share link.

## What we do not build in MVP

Not in MVP:
- booking integrations;
- automatic ticket parsing;
- hotel/flight search;
- paid itinerary marketplace;
- full map/routing engine;
- complex calendar drag-and-drop;
- multi-user collaboration / shared editing;
- backend;
- authentication;
- AI agent that plans the whole trip from scratch.

Important distinction:
- MVP can have "send/share my trip to a friend" as an export action.
- MVP should not have real-time collaboration, accounts, permissions, or shared editing.
- First share format can be plain text copied to clipboard, Telegram-friendly summary, or a generated static summary view.

Important link behavior:
- Backpacker must store clickable source links for tickets, excursions, cafes, hotels, spas and other items.
- The user should be able to return to the exact source page to pay, book or check details.
- For MVP, links are entered manually and displayed clearly.
- Later, investigate mobile browser share-to-app flow: the user copies/sends a page from Aviasales, Tripster, cafe site, etc. directly into Backpacker, and Backpacker creates a draft item card.

## Data model draft

Trip:
- id;
- title;
- destination;
- startDate;
- endDate;
- currency;
- budgetLimit;
- preferencesText;
- createdAt;
- updatedAt.

TripItem:
- id;
- tripId;
- title;
- type;
- status;
- priority;
- date;
- startTime;
- durationMinutes;
- price;
- paidAmount;
- link;
- locationText;
- notes;
- createdAt;
- updatedAt.

Derived values:
- scheduledItems;
- unscheduledItems;
- paidTotal;
- fixedTotal;
- optionalTotal;
- possibleTotal;
- remainingBudget.

## Suggested first implementation

Build a static frontend prototype first.

Recommended stack:
- Vite + React + TypeScript;
- localStorage persistence;
- no backend;
- no auth;
- simple CSS or Tailwind, depending on developer preference;
- deploy later via GitHub Pages.

Design / platform priority:
- mobile-first responsive web app;
- consider Telegram Mini App constraints from the beginning: narrow viewport, touch controls, quick actions, compact editing;
- do not design desktop first and then squeeze it into mobile;
- main test device is the phone.

Alternative for fastest possible version:
- plain HTML/CSS/JS with localStorage.

CTO preference:
Use React if the developer can scaffold quickly, because the app has state, filters, editable items, and multiple derived totals.

## Acceptance criteria for first build

The first build is good enough when:
- user can create one trip;
- user can add at least 20 items without UI breaking;
- user can edit item fields;
- user can assign items to specific days;
- user can leave items unscheduled;
- user can change status and priority;
- budget summary updates immediately;
- data survives page reload;
- layout works on desktop and mobile;
- mobile layout is not a secondary afterthought: primary flows must be usable on a phone;
- there is no dependency on external services;
- the app can be tested by Irina on her real upcoming trip.

## First test script for Irina

1. Create the upcoming trip.
2. Enter tickets and accommodation.
3. Enter all known excursions/activities.
4. Enter food/rest/spa/place ideas.
5. Add prices where known.
6. Mark what is paid/fixed/want/maybe.
7. Assign some items to days.
8. Leave uncertain items unscheduled.
9. Check budget.
10. During planning and on the trip, note where she still goes outside the app.

Questions after test:
- Did Backpacker replace notes/tabs/chats for this trip?
- What was easiest?
- What was annoying?
- Which field was missing?
- Which screen did she use most?
- Did budget summary help decisions?
- Did unscheduled items help reduce chaos?
- Would she use it for the next trip?

## First task for Codex developer

Build the first local prototype of Backpacker as a static frontend app.

Do not connect backend.
Do not use DocGen repositories.
Use the dedicated repository:
https://github.com/dphnll/Backpacker

Use the dedicated public demo repository when publishing:
https://github.com/dphnll/Backpacker_demo

Primary goal: Irina should be able to plan one real 3-4 day solo trip using the app.

Focus on:
- one trip dashboard;
- trip setup;
- item basket;
- day plan;
- unscheduled items;
- budget summary;
- budget table / estimate view with events, links and prices;
- localStorage persistence;
- mobile-friendly layout.
- mobile-first layout.
- Telegram Mini App compatibility as a possible next step.
- share/export trip summary for sending to a friend.

Avoid:
- integrations;
- AI planning;
- maps;
- auth;
- visual overdesign;
- generic travel landing page.
