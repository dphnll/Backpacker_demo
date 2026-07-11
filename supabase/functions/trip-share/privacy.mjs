const FINANCIAL_FIELDS = new Set(["price", "paidAmount", "budgetLimit", "allocations"]);

export function stripBudget(value) {
  if (Array.isArray(value)) return value.map(stripBudget);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !FINANCIAL_FIELDS.has(key))
      .map(([key, entry]) => [key, stripBudget(entry)]),
  );
}

export function getVisibleBudgetFields(trip, includeBudget) {
  if (!includeBudget) return {};
  const amount = Number(trip?.budgetLimit);
  return {
    budgetLimit: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
  };
}
