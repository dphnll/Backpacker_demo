(function attachTripDateCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BackpackerTripDates = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createTripDateCore() {
  "use strict";

  const VIRTUAL_DAY_PREFIX = "day-";

  function normalizeTripDayCount(value, fallback = 1) {
    const count = Math.ceil(Number(value));
    if (!Number.isFinite(count) || count <= 0) return fallback;
    return Math.max(1, Math.min(60, count));
  }

  function getVirtualDayIndex(value = "") {
    const match = String(value || "").match(/^day-(\d+)$/);
    if (!match) return 0;
    return normalizeTripDayCount(match[1], 0);
  }

  function isValidIsoDate(value = "") {
    const raw = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(`${raw}T12:00:00`);
    return !Number.isNaN(date.getTime())
      && date.getFullYear() === year
      && date.getMonth() + 1 === month
      && date.getDate() === day;
  }

  function getDateForTripDay(startDate = "", dayIndex = 0) {
    const index = normalizeTripDayCount(dayIndex, 0);
    if (!index || !isValidIsoDate(startDate)) return "";
    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + index - 1);
    return date.toISOString().slice(0, 10);
  }

  function getCalendarDayCount(startDate = "", endDate = "") {
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || endDate < startDate) return 0;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    const diff = Math.round((end - start) / 86400000);
    return Math.max(1, diff + 1);
  }

  function shouldMigrateVirtualDates(previousTrip = {}, nextTrip = {}) {
    return !previousTrip.startDate
      && !previousTrip.endDate
      && isValidIsoDate(nextTrip.startDate)
      && isValidIsoDate(nextTrip.endDate)
      && nextTrip.endDate >= nextTrip.startDate;
  }

  function migrateVirtualItemDatesToRealDates(items = [], previousTrip = {}, nextTrip = {}) {
    if (!shouldMigrateVirtualDates(previousTrip, nextTrip)) return items;
    const tripDayCount = getCalendarDayCount(nextTrip.startDate, nextTrip.endDate);
    return items.map((item) => {
      const virtualDayIndex = getVirtualDayIndex(item?.date || "");
      if (!virtualDayIndex || virtualDayIndex > tripDayCount) return item;
      const realDate = getDateForTripDay(nextTrip.startDate, virtualDayIndex);
      if (!realDate || realDate > nextTrip.endDate) return item;
      return { ...item, date: realDate };
    });
  }

  function isDateInTripRange(date = "", trip = {}) {
    if (!isValidIsoDate(date)) return false;
    if (!isValidIsoDate(trip.startDate) || !isValidIsoDate(trip.endDate) || trip.endDate < trip.startDate) return true;
    return date >= trip.startDate && date <= trip.endDate;
  }

  function moveOutOfRangeItemDatesToUnscheduled(items = [], trip = {}) {
    if (!isValidIsoDate(trip.startDate) || !isValidIsoDate(trip.endDate) || trip.endDate < trip.startDate) {
      return { items, movedCount: 0 };
    }
    let nextUnscheduledOrder = items
      .filter((item) => !item?.date)
      .reduce((max, item) => {
        const order = Number(item?.order);
        return Number.isFinite(order) ? Math.max(max, order + 1) : max;
      }, 0);
    let movedCount = 0;
    const nextItems = items.map((item) => {
      const itemDate = item?.date || "";
      if (!itemDate || getVirtualDayIndex(itemDate) || !isValidIsoDate(itemDate) || isDateInTripRange(itemDate, trip)) {
        return item;
      }
      const nextItem = { ...item, date: "", order: nextUnscheduledOrder };
      nextUnscheduledOrder += 1;
      movedCount += 1;
      return nextItem;
    });
    return { items: movedCount ? nextItems : items, movedCount };
  }

  return {
    VIRTUAL_DAY_PREFIX,
    getCalendarDayCount,
    getDateForTripDay,
    getVirtualDayIndex,
    isDateInTripRange,
    migrateVirtualItemDatesToRealDates,
    moveOutOfRangeItemDatesToUnscheduled,
    shouldMigrateVirtualDates,
  };
});
