const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDateForTripDay,
  migrateVirtualItemDatesToRealDates,
  moveOutOfRangeItemDatesToUnscheduled,
  shouldMigrateVirtualDates,
} = require("../trip-date-core.js");

test("maps virtual Day N to the matching real trip date", () => {
  assert.equal(getDateForTripDay("2026-09-11", 1), "2026-09-11");
  assert.equal(getDateForTripDay("2026-09-11", 2), "2026-09-12");
});

test("migrates virtual day items on first assignment of real date range", () => {
  const previousTrip = { startDate: "", endDate: "", dayCount: 3 };
  const nextTrip = { startDate: "2026-09-11", endDate: "2026-09-13" };
  const items = [
    { id: "museum", title: "Museum", date: "day-2", order: 0 },
    { id: "restaurant", title: "Restaurant", date: "day-2", order: 1 },
    { id: "walk", title: "Walk", date: "day-1", order: 0 },
    { id: "parking", title: "Parking", date: "", order: 5 },
  ];

  const migrated = migrateVirtualItemDatesToRealDates(items, previousTrip, nextTrip);

  assert.deepEqual(migrated.map((item) => ({ id: item.id, date: item.date, order: item.order })), [
    { id: "museum", date: "2026-09-12", order: 0 },
    { id: "restaurant", date: "2026-09-12", order: 1 },
    { id: "walk", date: "2026-09-11", order: 0 },
    { id: "parking", date: "", order: 5 },
  ]);
});

test("does not migrate again after dates already exist", () => {
  const previousTrip = { startDate: "2026-09-11", endDate: "2026-09-13" };
  const nextTrip = { startDate: "2026-09-12", endDate: "2026-09-14" };
  const items = [
    { id: "museum", date: "2026-09-12", order: 0 },
    { id: "legacy-virtual", date: "day-2", order: 1 },
  ];

  const migrated = migrateVirtualItemDatesToRealDates(items, previousTrip, nextTrip);

  assert.equal(migrated, items);
  assert.deepEqual(migrated.map((item) => item.date), ["2026-09-12", "day-2"]);
});

test("changing existing real dates does not change item dates", () => {
  const previousTrip = { startDate: "2026-09-11", endDate: "2026-09-13" };
  const nextTrip = { startDate: "2026-10-01", endDate: "2026-10-03" };
  const items = [
    { id: "museum", date: "2026-09-12", order: 0 },
    { id: "restaurant", date: "2026-09-12", order: 1 },
  ];

  const migrated = migrateVirtualItemDatesToRealDates(items, previousTrip, nextTrip);

  assert.equal(migrated, items);
  assert.deepEqual(migrated.map((item) => item.date), ["2026-09-12", "2026-09-12"]);
});

test("out-of-range virtual days are preserved instead of being silently moved", () => {
  const previousTrip = { startDate: "", endDate: "", dayCount: 5 };
  const nextTrip = { startDate: "2026-09-11", endDate: "2026-09-13" };
  const items = [
    { id: "valid", date: "day-3", order: 0 },
    { id: "out-of-range", date: "day-5", order: 1 },
  ];

  const migrated = migrateVirtualItemDatesToRealDates(items, previousTrip, nextTrip);

  assert.deepEqual(migrated.map((item) => ({ id: item.id, date: item.date, order: item.order })), [
    { id: "valid", date: "2026-09-13", order: 0 },
    { id: "out-of-range", date: "day-5", order: 1 },
  ]);
});

test("migration only starts when previous trip had no real dates and next trip has a valid range", () => {
  assert.equal(shouldMigrateVirtualDates({ startDate: "", endDate: "" }, { startDate: "2026-09-11", endDate: "2026-09-13" }), true);
  assert.equal(shouldMigrateVirtualDates({ startDate: "2026-09-10", endDate: "" }, { startDate: "2026-09-11", endDate: "2026-09-13" }), false);
  assert.equal(shouldMigrateVirtualDates({ startDate: "", endDate: "" }, { startDate: "2026-09-13", endDate: "2026-09-11" }), false);
  assert.equal(shouldMigrateVirtualDates({ startDate: "", endDate: "" }, { startDate: "2026-09-11", endDate: "" }), false);
});

test("moves multiple real item dates outside the new trip range to unscheduled preserving relative order", () => {
  const items = [
    { id: "old-before", date: "2026-08-30", order: 0 },
    { id: "inside", date: "2026-09-12", order: 0 },
    { id: "old-after", date: "2026-09-20", order: 1 },
    { id: "parking", date: "", order: 4 },
  ];

  const result = moveOutOfRangeItemDatesToUnscheduled(items, {
    startDate: "2026-09-11",
    endDate: "2026-09-13",
  });

  assert.equal(result.movedCount, 2);
  assert.deepEqual(result.items.map((item) => ({ id: item.id, date: item.date, order: item.order })), [
    { id: "old-before", date: "", order: 5 },
    { id: "inside", date: "2026-09-12", order: 0 },
    { id: "old-after", date: "", order: 6 },
    { id: "parking", date: "", order: 4 },
  ]);
});

test("out-of-range date cleanup is idempotent after items are unscheduled", () => {
  const items = [
    { id: "old-before", date: "2026-08-30", order: 0 },
    { id: "old-after", date: "2026-09-20", order: 1 },
    { id: "inside", date: "2026-09-12", order: 0 },
  ];
  const trip = { startDate: "2026-09-11", endDate: "2026-09-13" };

  const first = moveOutOfRangeItemDatesToUnscheduled(items, trip);
  const second = moveOutOfRangeItemDatesToUnscheduled(first.items, trip);

  assert.equal(first.movedCount, 2);
  assert.equal(second.movedCount, 0);
  assert.equal(second.items, first.items);
  assert.deepEqual(second.items.map((item) => item.id), ["old-before", "old-after", "inside"]);
  assert.deepEqual(second.items.map((item) => ({ date: item.date, order: item.order })), [
    { date: "", order: 0 },
    { date: "", order: 1 },
    { date: "2026-09-12", order: 0 },
  ]);
});

test("keeps in-range real dates, empty dates and virtual days unchanged", () => {
  const items = [
    { id: "inside-start", date: "2026-09-11", order: 0 },
    { id: "inside-end", date: "2026-09-13", order: 1 },
    { id: "undated", date: "", order: 2 },
    { id: "virtual", date: "day-2", order: 3 },
    { id: "invalid", date: "not-a-date", order: 4 },
  ];

  const result = moveOutOfRangeItemDatesToUnscheduled(items, {
    startDate: "2026-09-11",
    endDate: "2026-09-13",
  });

  assert.equal(result.movedCount, 0);
  assert.equal(result.items, items);
  assert.deepEqual(result.items.map((item) => item.date), ["2026-09-11", "2026-09-13", "", "day-2", "not-a-date"]);
});

test("does not move item dates when the trip range is incomplete or invalid", () => {
  const items = [
    { id: "old", date: "2026-08-30", order: 0 },
  ];

  assert.deepEqual(moveOutOfRangeItemDatesToUnscheduled(items, { startDate: "", endDate: "" }), { items, movedCount: 0 });
  assert.deepEqual(moveOutOfRangeItemDatesToUnscheduled(items, { startDate: "2026-09-13", endDate: "2026-09-11" }), { items, movedCount: 0 });
});
