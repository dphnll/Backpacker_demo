const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDateForTripDay,
  migrateVirtualItemDatesToRealDates,
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
