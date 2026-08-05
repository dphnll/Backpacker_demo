(function initTripDraftAiCore(root) {
  "use strict";

  const TRIP_DRAFT_AI_SCHEMA_VERSION = "trip_draft_ai.v1";
  const PRICE_CONFIDENCE_VALUES = Object.freeze(["confirmed", "estimate", "unknown"]);
  const BUDGET_LEVEL_VALUES = Object.freeze(["low", "medium", "high", "unknown"]);
  const DATE_PRECISION_VALUES = Object.freeze(["exact", "approximate", "none"]);
  const ITEM_TYPE_VALUES = Object.freeze(["stay", "transport", "excursion", "food", "place", "spa", "shopping", "idea", "other"]);
  const ITEM_STATUS_VALUES = Object.freeze(["paid", "fixed", "want", "maybe", "backup", "skipped"]);
  const ITEM_PRIORITY_VALUES = Object.freeze(["must", "nice", "optional"]);
  const CURRENCY_VALUES = Object.freeze(["RUB", "EUR", "SEK", "USD", "GEL", "TRY", "RSD", "BAM"]);
  const MAX_ITEMS = 80;
  const MAX_QUESTIONS = 5;

  function draftError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  // The model may only echo what the traveller actually wrote. Comparing without whitespace
  // lets "2 000" match "2000" and survives the spacing the model chooses in its own output.
  function compactForGrounding(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[\s  ]/g, "")
      .replace(/[‐-―]/g, "-");
  }

  function isGroundedText(value, sourceText) {
    const needle = compactForGrounding(value);
    if (!needle) return false;
    return compactForGrounding(sourceText).includes(needle);
  }

  // A number counts as the traveller's own only when its digits appear in what they wrote.
  function isGroundedAmount(value, sourceText) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const haystack = compactForGrounding(sourceText);
    const digits = String(Math.round(amount));
    if (haystack.includes(digits)) return true;
    // "25 000" written by the traveller, "25000" returned by the model, and the reverse.
    return haystack.replace(/(\d)[.,](\d{3})\b/g, "$1$2").includes(digits);
  }

  const tripDraftSchema = {
    type: "object",
    additionalProperties: false,
    required: ["trip", "items", "questions"],
    properties: {
      trip: {
        type: "object",
        additionalProperties: false,
        required: [
          "title", "destination", "startDate", "endDate", "dayCount", "datePrecision", "dateSourceText",
          "currency", "budgetLimit", "budgetLevel", "budgetSourceText", "preferencesText",
        ],
        properties: {
          title: { type: "string" },
          destination: { type: "string" },
          startDate: { type: "string", description: "YYYY-MM-DD or empty string" },
          endDate: { type: "string", description: "YYYY-MM-DD or empty string" },
          dayCount: { type: "number", description: "Trip duration in days. For a range like 3-4 days use the maximum. Use 1 when unknown." },
          datePrecision: { type: "string", enum: DATE_PRECISION_VALUES.slice() },
          dateSourceText: { type: ["string", "null"] },
          currency: { type: "string", enum: CURRENCY_VALUES.slice() },
          budgetLimit: { type: "number", description: "Only a sum the traveller stated explicitly. Use 0 when they named no sum." },
          budgetLevel: { type: "string", enum: BUDGET_LEVEL_VALUES.slice(), description: "Only a level the traveller stated explicitly. Never derive it from a sum." },
          budgetSourceText: { type: ["string", "null"], description: "The traveller's own wording for the budget, otherwise null." },
          preferencesText: { type: "string" },
        },
      },
      items: {
        type: "array",
        maxItems: MAX_ITEMS,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title", "type", "status", "priority", "date", "dayIndex", "startTime", "durationMinutes",
            "price", "priceConfidence", "priceSourceText", "link", "locationText", "notes",
          ],
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ITEM_TYPE_VALUES.slice() },
            status: { type: "string", enum: ITEM_STATUS_VALUES.slice() },
            priority: { type: "string", enum: ITEM_PRIORITY_VALUES.slice() },
            date: { type: "string", description: "YYYY-MM-DD when explicitly known, otherwise empty string" },
            dayIndex: { type: "number", description: "1-based day number when the order is clear and exact dates are unknown. Use 0 when unknown." },
            startTime: { type: "string", description: "HH:MM when explicitly known, otherwise empty string" },
            durationMinutes: { type: "number" },
            price: { type: "number", description: "Only a number the traveller stated. For a range use its lower bound. Use 0 when they named no price." },
            priceConfidence: { type: "string", enum: PRICE_CONFIDENCE_VALUES.slice() },
            priceSourceText: { type: ["string", "null"], description: "The traveller's own wording for the price, otherwise null." },
            link: { type: "string", description: "Only a URL the traveller wrote themselves, otherwise an empty string." },
            locationText: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
      questions: { type: "array", maxItems: MAX_QUESTIONS, items: { type: "string" } },
    },
  };

  // One source of truth for the rules. There is deliberately no second English copy:
  // two lists drifted apart once already.
  const TRIP_DRAFT_RULES = [
    "Ты превращаешь свободное описание поездки в черновик Backpacker.",
    "Верни только структурированный JSON по схеме.",
    "Сохраняй язык пользователя во всех человекочитаемых полях: название поездки, направление, названия карточек, локации, заметки, preferencesText и вопросы.",
    "Извлекай только то, что пользователь назвал сам: направление, даты, длительность, активности, ограничения, транспорт, число участников, бюджет и запреты.",
    "",
    "ДАТЫ",
    "Сегодняшняя дата передана тебе явно. Используй только её, не полагайся на собственные представления о текущем дне.",
    "Всегда заполняй trip.dayCount. Если точных дат нет, но названа длительность — используй её. Для диапазона вроде 3-4 дня бери максимум.",
    "Если пользователь назвал точные даты — datePrecision='exact', dateSourceText=null.",
    "Если назван приблизительный период — можешь предложить конкретный диапазон внутри него, поставить datePrecision='approximate' и сохранить исходную формулировку в dateSourceText. Первая половина месяца — диапазон в первой половине, середина — около середины, вторая половина — старт после 15 числа, конец месяца — последние 7-10 дней.",
    "Если год не назван, бери ближайший будущий подходящий месяц относительно переданной сегодняшней даты; если этот месяц уже прошёл в текущем году — следующий год.",
    "Если период неоднозначен — оставь даты пустыми, datePrecision='none', dateSourceText=null.",
    "Если дата события неизвестна, но понятно, что это День 1, День 2 и т.п. — оставь date пустым и заполни dayIndex.",
    "Если день и время явно не названы — date и startTime пустые, dayIndex=0: такие карточки уйдут в парковку.",
    "Не выдумывай точное время. Если время не названо — startTime пустой.",
    "",
    "ССЫЛКИ",
    "Никогда не придумывай URL. Ссылку можно вернуть только если пользователь написал её сам в исходном тексте.",
    "Если пользователь ссылку не давал — link должен быть пустой строкой. Пустая ссылка — нормальный результат.",
    "Не подставляй адреса сайтов по памяти, даже если уверен, что место существует.",
    "",
    "ЦЕНЫ",
    "Никогда не придумывай цену. Число можно вернуть только если пользователь назвал его сам.",
    "priceConfidence='confirmed' — пользователь назвал точную цену. price = это число, priceSourceText = его формулировка.",
    "priceConfidence='estimate' — пользователь назвал приблизительную цену или диапазон. price = нижняя граница диапазона, priceSourceText = исходная формулировка целиком, например '2000-3000 рублей'.",
    "priceConfidence='unknown' — цены в тексте нет. price=0, priceSourceText=null. Это обычный и ожидаемый результат.",
    "Диапазон нельзя превращать в точную цену: всегда priceConfidence='estimate' и полный диапазон в priceSourceText.",
    "Не оценивай стоимость по своим знаниям о ценах в стране, городе или заведении.",
    "",
    "БЮДЖЕТ",
    "budgetLimit — только сумма, названная пользователем явно. Иначе 0.",
    "budgetLevel — только уровень, названный пользователем явно: low для 'бюджетно', 'недорого', 'скромно'; medium для 'средний бюджет'; high для 'дорого', 'без ограничений', 'премиум'. Иначе unknown.",
    "Никогда не выводи budgetLevel из суммы и не выводи сумму из уровня. Если названо только одно — второе остаётся пустым.",
    "Если названы и уровень, и сумма — заполни оба.",
    "budgetSourceText — исходная формулировка бюджета, иначе null.",
    "",
    "ТИПЫ КАРТОЧЕК",
    "Не создавай тип ticket или 'Билет'. Билеты на транспорт — transport; билеты в музей или к достопримечательности — excursion или place; билеты на концерт — лучший подходящий существующий тип.",
    "transport только когда главная цель — перемещение из точки в точку: перелёт, поезд, автобус, трансфер, такси, аренда авто, метро, трамвай, паром как способ добраться. Конкретный способ оставляй в названии карточки.",
    "Если транспорт ради впечатления — прогулка на теплоходе, обзорная автобусная экскурсия, круиз с ужином — это excursion, food или другой тип по главной цели, не transport.",
    "spa для хаммама, бани и спа; excursion для туров и музеев; food для еды; place для прогулок и видовых мест; stay для жилья.",
    "",
    "КАРТОЧКИ И КОЛИЧЕСТВА",
    "Создавай по карточке на каждое конкретное место, событие, приём пищи, транспорт, жильё или идею, названные пользователем.",
    "Не подменяй конкретные идеи пользователя обобщёнными задачами вроде 'выбрать жильё', если он назвал конкретные места.",
    "Явные количества трактуй так: один/одна — 1; два/две/пара — 2; три — 3; несколько — 3; число N — N; диапазон N-M — верхняя граница M.",
    "Если названо количество однотипных мест — создай столько отдельных карточек, а не одну обобщённую. Сохраняй осмысленные названия; если конкретные места неизвестны — нумеруй нейтрально, например 'Кофейня 1', 'Кофейня 2'.",
    "Статус по умолчанию: want. Приоритет по умолчанию: nice.",
    "",
    "ПРЕДПОЧТЕНИЯ И ОГРАНИЧЕНИЯ",
    "preferencesText оформи как 4-6 коротких строк с буллитами, используя только присутствующие категории: '• Обязательно: ...', '• Темп: ...', '• Опционально: ...', '• Ограничения: ...'. Не пересказывай весь исходный текст и не дублируй конкретные события.",
    "Здоровье, аллергии, мобильность, питание, темп и запреты — это ограничения планирования. Фиксируй их в preferencesText или в notes карточки.",
    "Не давай медицинских советов, диагнозов и оценок рисков.",
    "",
    "ВОПРОСЫ",
    "Задай не больше пяти коротких уточняющих вопросов и только про действительно важные недостающие данные планирования.",
  ];

  function buildTripDraftPrompt({ today = "", timezone = "" } = {}) {
    const groundingLines = [
      "КОНТЕКСТ ВРЕМЕНИ",
      today ? `Сегодняшняя дата: ${today}.` : "Сегодняшняя дата не передана: не выводи даты по году и оставь datePrecision='none'.",
      timezone ? `Часовой пояс пользователя: ${timezone}.` : "",
      "",
    ].filter((line) => line !== "");
    return [...groundingLines, ...TRIP_DRAFT_RULES].join("\n");
  }

  function assertSupportedSchemaVersion(value) {
    const version = String(value ?? "").trim();
    if (!version) throw draftError("trip_draft_schema_version_missing");
    if (version !== TRIP_DRAFT_AI_SCHEMA_VERSION) throw draftError("trip_draft_schema_version_unsupported");
    return version;
  }

  function normalizePriceConfidence(value) {
    const confidence = String(value ?? "").trim().toLowerCase();
    return PRICE_CONFIDENCE_VALUES.includes(confidence) ? confidence : "unknown";
  }

  function normalizeBudgetLevel(value) {
    const level = String(value ?? "").trim().toLowerCase();
    return BUDGET_LEVEL_VALUES.includes(level) ? level : "unknown";
  }

  // Deterministic guardrail, not a request to the model: anything the traveller did not
  // write themselves is dropped here, so a well-formed hallucination cannot reach the draft.
  function applyDraftGuardrails(draft, sourceText = "") {
    const source = String(sourceText || "");
    const input = draft && typeof draft === "object" ? draft : {};
    const trip = input.trip && typeof input.trip === "object" ? { ...input.trip } : {};
    const items = Array.isArray(input.items) ? input.items : [];

    const budgetSourceText = String(trip.budgetSourceText || "").trim();
    const groundedBudgetSource = budgetSourceText && isGroundedText(budgetSourceText, source) ? budgetSourceText : "";
    trip.budgetLimit = isGroundedAmount(trip.budgetLimit, source) ? Number(trip.budgetLimit) : 0;
    // A level is a claim about the traveller's intent, so it needs their wording behind it.
    trip.budgetLevel = groundedBudgetSource ? normalizeBudgetLevel(trip.budgetLevel) : "unknown";
    trip.budgetSourceText = trip.budgetLevel !== "unknown" || trip.budgetLimit > 0 ? groundedBudgetSource : "";

    const guardedItems = items.map((rawItem) => {
      const item = rawItem && typeof rawItem === "object" ? { ...rawItem } : {};
      const link = String(item.link || "").trim();
      item.link = link && isGroundedText(link, source) ? link : "";

      const priceSourceText = String(item.priceSourceText || "").trim();
      const groundedPriceSource = priceSourceText && isGroundedText(priceSourceText, source) ? priceSourceText : "";
      const confidence = normalizePriceConfidence(item.priceConfidence);
      const groundedAmount = isGroundedAmount(item.price, source);
      if (confidence === "unknown" || !groundedAmount || !groundedPriceSource) {
        item.price = 0;
        item.priceConfidence = "unknown";
        item.priceSourceText = "";
      } else {
        item.price = Number(item.price);
        item.priceConfidence = confidence;
        item.priceSourceText = groundedPriceSource;
      }
      return item;
    });

    return { ...input, trip, items: guardedItems, questions: Array.isArray(input.questions) ? input.questions : [] };
  }

  const api = {
    BUDGET_LEVEL_VALUES,
    CURRENCY_VALUES,
    DATE_PRECISION_VALUES,
    ITEM_PRIORITY_VALUES,
    ITEM_STATUS_VALUES,
    ITEM_TYPE_VALUES,
    MAX_ITEMS,
    MAX_QUESTIONS,
    PRICE_CONFIDENCE_VALUES,
    TRIP_DRAFT_AI_SCHEMA_VERSION,
    TRIP_DRAFT_RULES,
    applyDraftGuardrails,
    assertSupportedSchemaVersion,
    buildTripDraftPrompt,
    isGroundedAmount,
    isGroundedText,
    normalizeBudgetLevel,
    normalizePriceConfidence,
    tripDraftSchema,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BackpackerTripDraftAiCore = api;
})(typeof window !== "undefined" ? window : globalThis);
