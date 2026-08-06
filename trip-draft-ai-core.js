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

  // The expected contract is a parameter so the document path can validate its own version
  // without weakening the text path, which keeps its default.
  function assertSupportedSchemaVersion(value, expected = TRIP_DRAFT_AI_SCHEMA_VERSION) {
    const version = String(value ?? "").trim();
    if (!version) throw draftError("trip_draft_schema_version_missing");
    if (version !== expected) throw draftError("trip_draft_schema_version_unsupported");
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

  // ---------------------------------------------------------------------------
  // Booking Pack: the traveller's own documents are the source of facts.
  // Slice 1 guardrails ground values in the traveller's typed text and therefore do not
  // apply here at all — there is no typed text. Evidence rules below take their place.
  // ---------------------------------------------------------------------------

  const BOOKING_PACK_SCHEMA_VERSION = "booking_pack.v1";
  const BOOKING_PACK_MAX_FILES = 8;
  const BOOKING_PACK_MAX_FILE_BYTES = 10 * 1024 * 1024;
  const BOOKING_PACK_MAX_TOTAL_BYTES = 30 * 1024 * 1024;
  const BOOKING_PACK_MAX_EVIDENCE_CHARS = 160;
  const PRICE_KIND_VALUES = Object.freeze(["exact", "approximate"]);

  // Label-driven redaction. Blocking by shape alone would also destroy a flight number,
  // so a value is removed because of the word standing next to it, not because of its form.
  // \w does not cover Cyrillic in JavaScript, so Russian labels use an explicit letter class.
  // Using \w here silently disabled every Russian rule.
  const SENSITIVE_LABELLED_PATTERNS = [
    /(?:pnr|код[\s№#:]*брон[а-яё]*|номер[\s№#:]*брон[а-яё]*|booking[\s]*(?:reference|ref|code|number)|reservation[\s]*code)[\s№#:.-]*[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9-]{3,}/gi,
    /(?:номер[\s№#:]*билета|ticket[\s]*(?:no|number|#)|e-?ticket)[\s№#:.-]*[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9-]{5,}/gi,
    /(?:паспорт[а-яё]*|passport|документ[\s№#:]*удостовер[а-яё]*)[\s№#:.-]*[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9\s-]{4,}/gi,
    /(?:карт[а-яё]*|card|visa|mastercard|мир)[\s№#:.-]*(?:\d[\s-]?){12,19}/gi,
  ];

  // Second net: shapes that are sensitive whatever stands next to them.
  const SENSITIVE_SHAPE_PATTERNS = [
    /\b(?:\d[\s-]?){13,19}\b/g,
    /\b\d{13}\b/g,
  ];

  function sanitizeExtractedText(value, limit = 1000) {
    let text = String(value ?? "");
    SENSITIVE_LABELLED_PATTERNS.forEach((pattern) => {
      text = text.replace(pattern, " ");
    });
    SENSITIVE_SHAPE_PATTERNS.forEach((pattern) => {
      text = text.replace(pattern, " ");
    });
    return text.replace(/\s{2,}/g, " ").trim().slice(0, limit);
  }

  const bookingPackSchema = {
    type: "object",
    additionalProperties: false,
    required: ["trip", "items", "questions"],
    properties: {
      trip: {
        type: "object",
        additionalProperties: false,
        required: ["title", "destination", "currency", "preferencesText"],
        properties: {
          title: { type: "string" },
          destination: { type: "string" },
          currency: { type: "string", enum: CURRENCY_VALUES.slice() },
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
            "title", "type", "status", "priority", "date", "startTime", "durationMinutes",
            "price", "currency", "priceKind", "evidenceText", "sourceFileIndex", "sourcePage",
            "locationText", "notes",
          ],
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ITEM_TYPE_VALUES.slice() },
            status: { type: "string", enum: ITEM_STATUS_VALUES.slice() },
            priority: { type: "string", enum: ITEM_PRIORITY_VALUES.slice() },
            date: { type: "string", description: "YYYY-MM-DD from the document, otherwise empty string" },
            startTime: { type: "string", description: "HH:MM from the document, otherwise empty string" },
            durationMinutes: { type: "number" },
            price: { type: "number", description: "Only a number printed in the document. Use 0 when absent." },
            currency: { type: ["string", "null"], description: "Currency printed next to the price, otherwise null." },
            priceKind: { type: ["string", "null"], enum: ["exact", "approximate", null] },
            evidenceText: { type: ["string", "null"], description: "Short verbatim quote proving the price, under 160 characters, otherwise null." },
            sourceFileIndex: { type: "array", maxItems: BOOKING_PACK_MAX_FILES, items: { type: "number" } },
            sourcePage: { type: ["number", "null"] },
            locationText: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
      questions: { type: "array", maxItems: MAX_QUESTIONS, items: { type: "string" } },
    },
  };

  const BOOKING_PACK_RULES = [
    "Ты извлекаешь факты из документов поездки: билетов, броней, ваучеров и подтверждений.",
    "Верни только структурированный JSON по схеме. Источник фактов — исключительно приложенные документы.",
    "Ничего не выдумывай. Если факта в документах нет — оставь поле пустым и при необходимости задай вопрос.",
    "Не пользуйся своими знаниями о ценах, расписаниях, отелях и достопримечательностях.",
    "",
    "ДАТЫ И ВРЕМЯ",
    "Сегодняшняя дата передана явно. Используй её только чтобы понять год, если в документе он не напечатан.",
    "date и startTime бери из документа. Если время не напечатано — startTime пустой.",
    "Даты поездки не придумывай: приложение выведет их из найденных карточек.",
    "",
    "КАРТОЧКИ",
    "Транспорт: одна карточка на один сегмент перемещения. Билет туда и обратно — две отдельные карточки.",
    "В названии транспортной карточки оставляй вид и маршрут, например 'Перелёт Москва — Тбилиси'.",
    "Номер рейса, поезда или автобусного маршрута можно оставить в названии или заметке: это полезные сведения о маршруте.",
    "Проживание: одна карточка на всё бронирование, с датой заезда. Не создавай отдельную карточку на каждую ночь.",
    "Экскурсии, рестораны и мероприятия: одна карточка на одну бронь.",
    "Если один документ описывает несколько событий — создай несколько карточек и укажи у всех один и тот же sourceFileIndex.",
    "Если одно событие подтверждено несколькими документами — перечисли все их индексы в sourceFileIndex.",
    "",
    "ЦЕНА",
    "price — только число, напечатанное в документе.",
    "currency — валюта, напечатанная рядом с этим числом, всегда трёхбуквенным кодом ISO 4217: RUB, EUR, USD, GEL, GBP, PLN, AED и любым другим. Символ ₽ — это RUB, € — EUR, $ — USD, ₾ — GEL, £ — GBP. Если валюта в документе не напечатана и не следует из символа — currency=null.",
    "Не подставляй валюту по стране вылета, языку документа или своим предположениям.",
    "evidenceText — короткая дословная цитата из документа, подтверждающая цену, не длиннее 160 символов. Не абзац и не вся строка.",
    "priceKind='exact' для точной итоговой суммы, 'approximate' для приблизительной или диапазона.",
    "Если цены в документе нет — price=0, currency=null, priceKind=null, evidenceText=null. Это нормальный результат.",
    "Никогда не оценивай стоимость сам.",
    "",
    "ЧЕГО НЕ ИЗВЛЕКАТЬ",
    "Не переноси в поля карточки: коды бронирования и PNR, номера билетов, номера и изображения QR и штрихкодов, имена и фамилии пассажиров, паспортные данные, номера карт и любые платёжные реквизиты.",
    "Эти данные остаются в самом документе, который будет приложен к карточке. Приложению они не нужны.",
    "Номер рейса, поезда и автобусного маршрута к запрещённым не относятся: это описание маршрута, а не удостоверяющий реквизит.",
    "",
    "ВОПРОСЫ",
    "Задай не больше пяти коротких вопросов, если документ нечитаем, данные противоречат друг другу или важного факта не хватает.",
  ];

  function buildBookingPackPrompt({ today = "", timezone = "" } = {}) {
    const grounding = [
      "КОНТЕКСТ ВРЕМЕНИ",
      today ? `Сегодняшняя дата: ${today}.` : "Сегодняшняя дата не передана: год из документа не достраивай.",
      timezone ? `Часовой пояс пользователя: ${timezone}.` : "",
      "",
    ].filter((line) => line !== "");
    return [...grounding, ...BOOKING_PACK_RULES].join("\n");
  }

  const VIRTUAL_DAY_PREFIX = "day-";

  function isValidIsoDate(value) {
    const raw = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(`${raw}T12:00:00`);
    return !Number.isNaN(date.getTime())
      && date.getFullYear() === year
      && date.getMonth() + 1 === month
      && date.getDate() === day;
  }

  function addTripDays(startDate, offset) {
    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function countTripDaysBetween(startDate, targetDate) {
    const start = new Date(`${startDate}T12:00:00`);
    const target = new Date(`${targetDate}T12:00:00`);
    return Math.round((target.getTime() - start.getTime()) / 86400000);
  }

  function normalizeDayIndex(value, dayCount) {
    const index = Math.trunc(Number(value));
    if (!Number.isFinite(index) || index <= 0) return 0;
    return index;
  }

  function getChronologyTitle(item) {
    return String(item?.title || "").trim() || "Карточка";
  }

  // Resolves one card's day from the traveller's own signals only. Array position is never
  // consulted, so shuffling the model's output cannot change where a card lands.
  function resolveTripItemDay(item = {}, trip = {}) {
    const startDate = isValidIsoDate(trip.startDate) ? String(trip.startDate).trim() : "";
    const endDate = isValidIsoDate(trip.endDate) ? String(trip.endDate).trim() : "";
    const hasCalendar = Boolean(startDate && endDate && endDate >= startDate);
    const dayCount = Math.max(1, Math.trunc(Number(trip.dayCount)) || 1);
    const title = getChronologyTitle(item);
    const rawDate = isValidIsoDate(item.date) ? String(item.date).trim() : "";
    const dayIndex = normalizeDayIndex(item.dayIndex, dayCount);

    if (rawDate) {
      if (!hasCalendar) {
        // A calendar date cannot be placed on a numbered day, and keeping it would hide the
        // card from the plan entirely.
        return { date: "", question: `Для «${title}» указана дата, но у поездки не заданы даты. Задайте даты поездки или выберите день.` };
      }
      if (rawDate < startDate || rawDate > endDate) {
        // Never clamped to the first or last day: that would invent a decision.
        return { date: "", question: `Для «${title}» указана дата вне дат поездки. На какой день её поставить?` };
      }
      const derivedIndex = countTripDaysBetween(startDate, rawDate) + 1;
      if (dayIndex > 0 && dayIndex !== derivedIndex) {
        return { date: rawDate, question: `Для «${title}» дата и день не совпали. Оставили дату — проверьте, верно ли.` };
      }
      return { date: rawDate };
    }

    if (dayIndex > 0) {
      if (dayIndex > dayCount) {
        return { date: "", question: `Для «${title}» назван день, которого нет в поездке. На какой день её поставить?` };
      }
      return { date: hasCalendar ? addTripDays(startDate, dayIndex - 1) : `${VIRTUAL_DAY_PREFIX}${dayIndex}` };
    }

    // No signal at all is an ordinary outcome: the card waits in the unscheduled list and
    // does not deserve a question of its own.
    return { date: "" };
  }

  function mergeTripChronologyQuestions(generated = [], existing = [], max = MAX_QUESTIONS) {
    const seen = new Set();
    const merged = [];
    // Generated questions name a concrete card and a fixable problem, so they come first.
    [...generated, ...existing].forEach((entry) => {
      const text = String(entry ?? "").trim();
      if (!text) return;
      const key = text.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(text);
    });
    return merged.slice(0, max);
  }

  function applyTripChronology(draft = {}) {
    const input = draft && typeof draft === "object" ? draft : {};
    const trip = input.trip && typeof input.trip === "object" ? input.trip : {};
    const items = Array.isArray(input.items) ? input.items : [];
    const generated = [];
    const nextItems = items.map((rawItem) => {
      const item = rawItem && typeof rawItem === "object" ? { ...rawItem } : {};
      const resolved = resolveTripItemDay(item, trip);
      if (resolved.question) generated.push(resolved.question);
      item.date = resolved.date;
      // The day is settled here, so a contradicting index must not survive downstream.
      delete item.dayIndex;
      return item;
    });
    return {
      ...input,
      items: nextItems,
      questions: mergeTripChronologyQuestions(generated, input.questions, MAX_QUESTIONS),
    };
  }

  // A file is matched back after a reload by name, size and type. The pack is deduplicated
  // on exactly that triple, so within one pack the key is unique by construction.
  function getBookingPackFileKey(descriptor = {}) {
    return [
      String(descriptor.fileName ?? descriptor.name ?? "").trim().toLowerCase(),
      String(descriptor.fileSize ?? descriptor.size ?? ""),
      String(descriptor.mimeType ?? descriptor.type ?? "").trim().toLowerCase(),
    ].join("|");
  }

  function matchBookingPackFiles(descriptors = [], files = []) {
    const pool = new Map();
    files.forEach((file) => {
      const key = getBookingPackFileKey(file);
      if (!pool.has(key)) pool.set(key, []);
      pool.get(key).push(file);
    });
    const matched = {};
    const missing = [];
    descriptors.forEach((descriptor) => {
      const bucket = pool.get(getBookingPackFileKey(descriptor));
      const file = bucket && bucket.length ? bucket.shift() : null;
      if (file) matched[descriptor.sourceFileId] = file;
      else missing.push(descriptor);
    });
    return { matched, missing };
  }

  function normalizePriceKind(value) {
    const kind = String(value ?? "").trim().toLowerCase();
    return PRICE_KIND_VALUES.includes(kind) ? kind : "";
  }

  // Any ISO-shaped code is kept, not just the eight the trip can be denominated in: a ticket
  // priced in GBP must still be readable in the preview. It stays draft-only and, unless it
  // matches the trip currency, its number never reaches the card or the budget.
  function normalizeDocumentCurrency(value) {
    const code = String(value ?? "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : "";
  }

  // A number is only meaningful in its own currency, so converting it silently would invent
  // a fact. Mismatched currencies keep the number visible and out of the budget.
  function isBookingPackPriceBudgetEligible(item = {}, tripCurrency = "") {
    const documentCurrency = normalizeDocumentCurrency(item.documentCurrency);
    if (!documentCurrency) return false;
    return documentCurrency === normalizeDocumentCurrency(tripCurrency);
  }

  // Trip dates are derived, never asked of the model: the earliest and latest day found.
  function deriveBookingPackTripDates(items = []) {
    const dates = items
      .map((item) => String(item?.date || "").trim())
      .filter((date) => isValidIsoDate(date))
      .sort();
    if (!dates.length) return { startDate: "", endDate: "" };
    return { startDate: dates[0], endDate: dates[dates.length - 1] };
  }

  // Evidence rules replace the Slice 1 guardrails on this path. A price is admitted only
  // when the document actually shows it: amount, currency, a quote and a real file behind it.
  function applyBookingPackEvidenceRules(draft = {}, { fileIds = [] } = {}) {
    const input = draft && typeof draft === "object" ? draft : {};
    const rawTrip = input.trip && typeof input.trip === "object" ? input.trip : {};
    const rawItems = Array.isArray(input.items) ? input.items : [];
    const generated = [];

    const items = rawItems.slice(0, MAX_ITEMS).map((rawItem) => {
      const item = rawItem && typeof rawItem === "object" ? { ...rawItem } : {};
      const sourceFileIds = (Array.isArray(item.sourceFileIndex) ? item.sourceFileIndex : [])
        .map((index) => fileIds[Math.trunc(Number(index))])
        .filter(Boolean);
      const title = sanitizeExtractedText(item.title, 120);
      const evidenceText = sanitizeExtractedText(item.evidenceText, BOOKING_PACK_MAX_EVIDENCE_CHARS);
      const amount = Number(item.price);
      const documentCurrency = normalizeDocumentCurrency(item.currency);
      const priceKind = normalizePriceKind(item.priceKind);
      const priceAdmitted = Number.isFinite(amount) && amount > 0 && Boolean(documentCurrency)
        && Boolean(evidenceText) && sourceFileIds.length > 0;
      if (!priceAdmitted && Number.isFinite(amount) && amount > 0) {
        generated.push(`Для «${title || "карточки"}» цена в документе не подтверждена. Проверьте и впишите её вручную.`);
      }
      return {
        ...item,
        title,
        locationText: sanitizeExtractedText(item.locationText, 160),
        notes: sanitizeExtractedText(item.notes, 1000),
        // Until the traveller presses create this is an extracted value, never a confirmed fact.
        price: priceAdmitted ? amount : 0,
        priceConfidence: priceAdmitted ? "estimate" : "unknown",
        priceSourceText: "",
        priceKind: priceAdmitted ? (priceKind || "approximate") : "",
        evidenceText: priceAdmitted ? evidenceText : "",
        // Draft-only: the card model has no per-item currency and does not gain one here.
        documentCurrency: priceAdmitted ? documentCurrency : "",
        sourceFileIds,
        sourcePage: Number.isFinite(Number(item.sourcePage)) ? Math.trunc(Number(item.sourcePage)) : null,
        dayIndex: 0,
        sourceFileIndex: undefined,
      };
    });

    const { startDate, endDate } = deriveBookingPackTripDates(items);
    return {
      trip: {
        ...rawTrip,
        title: sanitizeExtractedText(rawTrip.title, 80) || "Поездка по документам",
        destination: sanitizeExtractedText(rawTrip.destination, 120),
        preferencesText: sanitizeExtractedText(rawTrip.preferencesText, 4000),
        startDate,
        endDate,
        datePrecision: startDate ? "exact" : "none",
        dateSourceText: "",
        budgetLimit: 0,
        budgetLevel: "unknown",
        budgetSourceText: "",
      },
      items,
      questions: mergeTripChronologyQuestions(generated, input.questions, MAX_QUESTIONS),
    };
  }

  // Pressing create is what turns an extracted number into a confirmed one — but only when
  // the document speaks the same currency as the trip. Otherwise the card gets no number.
  function resolveConfirmedPriceConfidence(item = {}, tripCurrency = "") {
    if (!item || !item.priceKind) return item?.priceConfidence || "unknown";
    if (item.documentCurrency && !isBookingPackPriceBudgetEligible(item, tripCurrency)) return "unknown";
    return item.priceKind === "exact" ? "confirmed" : "estimate";
  }

  const api = {
    BOOKING_PACK_MAX_EVIDENCE_CHARS,
    BOOKING_PACK_MAX_FILES,
    BOOKING_PACK_MAX_FILE_BYTES,
    BOOKING_PACK_MAX_TOTAL_BYTES,
    BOOKING_PACK_SCHEMA_VERSION,
    BOOKING_PACK_RULES,
    PRICE_KIND_VALUES,
    applyBookingPackEvidenceRules,
    bookingPackSchema,
    buildBookingPackPrompt,
    deriveBookingPackTripDates,
    getBookingPackFileKey,
    isBookingPackPriceBudgetEligible,
    matchBookingPackFiles,
    normalizeDocumentCurrency,
    resolveConfirmedPriceConfidence,
    sanitizeExtractedText,
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
    applyTripChronology,
    assertSupportedSchemaVersion,
    buildTripDraftPrompt,
    mergeTripChronologyQuestions,
    resolveTripItemDay,
    isGroundedAmount,
    isGroundedText,
    normalizeBudgetLevel,
    normalizePriceConfidence,
    tripDraftSchema,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BackpackerTripDraftAiCore = api;
})(typeof window !== "undefined" ? window : globalThis);
