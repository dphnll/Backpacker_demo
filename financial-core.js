(function initBackpackerFinancial(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BackpackerFinancial = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createBackpackerFinancial() {
  const CONFIRMED_STATUSES = new Set(["paid", "fixed"]);
  const ADDITIONAL_STATUSES = new Set(["want", "maybe"]);
  const FINANCIAL_FIELDS = new Set(["price", "paidAmount", "budgetLimit", "allocations"]);

  function roundMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    const scaled = amount * 100;
    return Math.round(scaled + Math.sign(scaled) * 1e-7) / 100;
  }

  function normalizeMoneyText(value) {
    let text = String(value ?? "")
      .trim()
      .replace(/[\s\u00a0\u202f]/g, "")
      .replace(/[^\d.,-]/g, "");
    if (!text) return "";
    const negative = text.startsWith("-");
    text = text.replace(/-/g, "");
    if (!text) return "";

    const commaIndex = text.lastIndexOf(",");
    const dotIndex = text.lastIndexOf(".");
    let decimalIndex = -1;
    if (commaIndex >= 0 && dotIndex >= 0) {
      decimalIndex = Math.max(commaIndex, dotIndex);
    } else {
      const separatorIndex = Math.max(commaIndex, dotIndex);
      if (separatorIndex >= 0) {
        const fractionalLength = text.length - separatorIndex - 1;
        if (fractionalLength >= 1 && fractionalLength <= 2) decimalIndex = separatorIndex;
        else if (fractionalLength === 3) decimalIndex = -1;
        else return "";
      }
    }

    const integerPart = (decimalIndex >= 0 ? text.slice(0, decimalIndex) : text).replace(/[.,]/g, "") || "0";
    const fractionalPart = decimalIndex >= 0 ? text.slice(decimalIndex + 1).replace(/[.,]/g, "") : "";
    return `${negative ? "-" : ""}${integerPart}${fractionalPart ? `.${fractionalPart}` : ""}`;
  }

  function parseMoney(value) {
    if (typeof value === "number") return value > 0 && Number.isFinite(value) ? roundMoney(value) : 0;
    const normalized = normalizeMoneyText(value);
    if (!normalized) return 0;
    const amount = Number(normalized);
    return amount > 0 && Number.isFinite(amount) ? roundMoney(amount) : 0;
  }

  function isValidMoney(value, { allowEmpty = true } = {}) {
    if (typeof value === "number") return Number.isFinite(value);
    const text = String(value ?? "").trim();
    if (!text) return allowEmpty;
    return Boolean(normalizeMoneyText(text));
  }

  function getEffectivePaid(item, price = parseMoney(item?.price)) {
    const paidAmount = parseMoney(item?.paidAmount);
    if (paidAmount > 0) return Math.min(paidAmount, price);
    return item?.status === "paid" ? price : 0;
  }

  function normalizeAllocations(allocations, { price = 0, participantIds = [], ownerId = "" } = {}) {
    const safePrice = parseMoney(price);
    const validParticipantIds = new Set(participantIds.filter(Boolean));
    const merged = new Map();
    if (Array.isArray(allocations)) {
      allocations.forEach((allocation) => {
        const participantId = String(allocation?.participantId || "");
        const amount = parseMoney(allocation?.amount);
        if (!participantId || !validParticipantIds.has(participantId) || amount <= 0) return;
        merged.set(participantId, roundMoney((merged.get(participantId) || 0) + amount));
      });
    }
    const normalized = Array.from(merged, ([participantId, amount]) => ({ participantId, amount }));
    if (!normalized.length && safePrice > 0 && validParticipantIds.has(ownerId)) {
      return [{ participantId: ownerId, amount: safePrice }];
    }
    return normalized;
  }

  function addMoney(total, value) {
    return roundMoney(total + value);
  }

  function getFinancialSummary(nextState = {}) {
    const trip = nextState?.trip || {};
    const items = Array.isArray(nextState?.items) ? nextState.items : [];
    const summary = {
      budgetLimit: parseMoney(trip.budgetLimit),
      paidTotal: 0,
      confirmedTotal: 0,
      confirmedOutstanding: 0,
      additionalTotal: 0,
      possibleTotal: 0,
      remainingConfirmed: 0,
      remainingAll: 0,
    };

    items.forEach((item) => {
      const status = String(item?.status || "");
      const isConfirmed = CONFIRMED_STATUSES.has(status);
      const isAdditional = ADDITIONAL_STATUSES.has(status);
      if (!isConfirmed && !isAdditional) return;
      const price = parseMoney(item?.price);
      const effectivePaid = getEffectivePaid(item, price);
      summary.paidTotal = addMoney(summary.paidTotal, effectivePaid);
      if (isConfirmed) {
        summary.confirmedTotal = addMoney(summary.confirmedTotal, price);
        summary.confirmedOutstanding = addMoney(summary.confirmedOutstanding, Math.max(price - effectivePaid, 0));
      } else {
        summary.additionalTotal = addMoney(summary.additionalTotal, price);
      }
    });

    summary.possibleTotal = addMoney(summary.confirmedTotal, summary.additionalTotal);
    summary.remainingConfirmed = roundMoney(summary.budgetLimit - summary.confirmedTotal);
    summary.remainingAll = roundMoney(summary.budgetLimit - summary.possibleTotal);
    return summary;
  }

  function stripFinancialFields(value) {
    if (Array.isArray(value)) return value.map(stripFinancialFields);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !FINANCIAL_FIELDS.has(key))
        .map(([key, entry]) => [key, stripFinancialFields(entry)]),
    );
  }

  return {
    getEffectivePaid,
    getFinancialSummary,
    normalizeMoneyText,
    normalizeAllocations,
    parseMoney,
    isValidMoney,
    roundMoney,
    stripFinancialFields,
  };
}));
