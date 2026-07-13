(function attachTripDraftQuantityCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BackpackerTripDraftQuantities = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createTripDraftQuantityCore() {
  "use strict";

  const MVP_MAX_QUANTITY = 6;
  const MAX_DRAFT_ITEMS = 80;
  const QUANTITY_TOKEN = "(?:\\d{1,2}\\s*[-–—]\\s*\\d{1,2}|\\d{1,2}|один|одна|два|две|пара|три|несколько)";
  const GENERIC_TITLE_WORDS = new Set([
    "в", "во", "и", "на", "для", "по", "у",
    "один", "одна", "два", "две", "пара", "три", "несколько",
    "хороший", "хорошая", "хорошие", "хороших",
    "разный", "разная", "разные", "разных",
    "посетить", "посещение", "сходить", "найти", "выбрать", "подобрать", "попробовать", "запланировать",
  ]);
  const ITEM_KINDS = [
    {
      key: "cafe",
      sourcePattern: "(?:кофейн[а-яё]*|кафе)",
      itemPattern: /(?:кофейн|кафе)/iu,
      types: ["food"],
      getLabel: (phrase) => /кофейн/iu.test(phrase) ? "Кофейня" : "Кафе",
    },
    {
      key: "restaurant",
      sourcePattern: "ресторан[а-яё]*",
      itemPattern: /ресторан/iu,
      types: ["food"],
      getLabel: () => "Ресторан",
    },
    {
      key: "museum",
      sourcePattern: "музе[йяеию][а-яё]*",
      itemPattern: /музе/iu,
      types: ["excursion", "place"],
      getLabel: () => "Музей",
    },
    {
      key: "excursion",
      sourcePattern: "экскурси[яиюей][а-яё]*",
      itemPattern: /экскурси/iu,
      types: ["excursion"],
      getLabel: () => "Экскурсия",
    },
    {
      key: "spa",
      sourcePattern: "(?:бан[яиюей][а-яё]*|саун[а-яё]*|хаммам[а-яё]*|спа)",
      itemPattern: /(?:бан[яиюей]|саун|хаммам|спа)/iu,
      types: ["spa"],
      getLabel: (phrase) => /саун/iu.test(phrase) ? "Сауна" : /хаммам/iu.test(phrase) ? "Хаммам" : /спа/iu.test(phrase) ? "Спа" : "Баня",
    },
  ];

  function parseQuantityToken(value, maxQuantity = MVP_MAX_QUANTITY) {
    const token = String(value || "").trim().toLowerCase();
    const range = token.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})$/u);
    let quantity = 0;
    if (range) {
      quantity = Math.max(Number(range[1]), Number(range[2]));
    } else if (/^\d{1,2}$/u.test(token)) {
      quantity = Number(token);
    } else {
      quantity = {
        один: 1,
        одна: 1,
        два: 2,
        две: 2,
        пара: 2,
        три: 3,
        несколько: 3,
      }[token] || 0;
    }
    return Number.isInteger(quantity) && quantity > 0 && quantity <= maxQuantity ? quantity : 0;
  }

  function extractExplicitItemQuantities(sourceText = "", options = {}) {
    const text = String(sourceText || "");
    const maxQuantity = Number(options.maxQuantity) || MVP_MAX_QUANTITY;
    const mentions = [];
    ITEM_KINDS.forEach((definition) => {
      const modifier = "(?!(?:и|или|а|но)(?=$|[^\\p{L}]))[\\p{L}-]+";
      const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${QUANTITY_TOKEN})\\s+(?:${modifier}\\s+){0,2}(${definition.sourcePattern})(?=$|[^\\p{L}])`, "giu");
      for (const match of text.matchAll(pattern)) {
        const count = parseQuantityToken(match[1], maxQuantity);
        if (!count) continue;
        const phrase = `${match[1]} ${match[2]}`.trim();
        mentions.push({
          kind: definition.key,
          count,
          label: definition.getLabel(phrase),
          phrase,
          index: match.index || 0,
        });
      }
    });
    return mentions.sort((left, right) => left.index - right.index);
  }

  function normalizeTitle(value = "") {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
  }

  function getLooseTokenKey(value = "") {
    const token = String(value || "").toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
    return token.length > 5 ? token.slice(0, 5) : token;
  }

  function isGeneralizedItem(item, definition, contextText = "") {
    const title = String(item?.title || "").trim();
    if (!title || !definition.itemPattern.test(title)) return false;
    if (/[«»"“”]/u.test(title)) return false;
    const contextKeys = new Set(String(contextText || "").split(/[^\p{L}\p{N}]+/u).map(getLooseTokenKey).filter(Boolean));
    const tokens = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return tokens.every((token) => {
      const normalized = token.toLocaleLowerCase("ru-RU");
      if (/^\d+$/u.test(normalized)) return true;
      if (GENERIC_TITLE_WORDS.has(normalized)) return true;
      if (definition.itemPattern.test(normalized)) return true;
      const key = getLooseTokenKey(normalized);
      return key.length >= 3 && contextKeys.has(key);
    });
  }

  function hasDuplicateTitles(items, indices) {
    const titles = indices.map((index) => normalizeTitle(items[index]?.title));
    return new Set(titles).size < titles.length;
  }

  function numberMatchingItems(items, indices, label) {
    const nextItems = items.slice();
    indices.forEach((itemIndex, index) => {
      nextItems[itemIndex] = { ...nextItems[itemIndex], title: `${label} ${index + 1}` };
    });
    return nextItems;
  }

  function applyExplicitItemQuantities(sourceText = "", items = [], options = {}) {
    if (!Array.isArray(items) || !items.length || !String(sourceText || "").trim()) return items;
    const maxQuantity = Number(options.maxQuantity) || MVP_MAX_QUANTITY;
    const maxItems = Number(options.maxItems) || MAX_DRAFT_ITEMS;
    const contextText = String(options.contextText || "");
    const mentions = extractExplicitItemQuantities(sourceText, { maxQuantity });
    const mentionsByKind = mentions.reduce((map, mention) => {
      const group = map.get(mention.kind) || [];
      group.push(mention);
      map.set(mention.kind, group);
      return map;
    }, new Map());
    let nextItems = items;

    mentionsByKind.forEach((kindMentions, kind) => {
      if (kindMentions.length !== 1) return;
      const mention = kindMentions[0];
      const definition = ITEM_KINDS.find((entry) => entry.key === kind);
      if (!definition) return;
      const overlappingTypeMentions = mentions.filter((entry) => {
        const otherDefinition = ITEM_KINDS.find((candidate) => candidate.key === entry.kind);
        return otherDefinition?.types?.some((type) => definition.types.includes(type));
      });
      const typeMatchingIndices = overlappingTypeMentions.length === 1
        ? nextItems.reduce((indices, item, index) => {
          if (definition.types.includes(String(item?.type || ""))) indices.push(index);
          return indices;
        }, [])
        : [];
      const matchingIndices = [];
      nextItems.forEach((item, index) => {
        const searchable = `${item?.title || ""} ${item?.notes || ""} ${item?.locationText || ""}`;
        if (definition.itemPattern.test(searchable)) matchingIndices.push(index);
      });
      if (!matchingIndices.length) return;

      if (typeMatchingIndices.length > 1) {
        if (typeMatchingIndices.length === mention.count && hasDuplicateTitles(nextItems, typeMatchingIndices)) {
          nextItems = numberMatchingItems(nextItems, typeMatchingIndices, mention.label);
        }
        return;
      }

      if (matchingIndices.length === 1 && mention.count > 1) {
        const itemIndex = matchingIndices[0];
        const sourceItem = nextItems[itemIndex];
        if (!isGeneralizedItem(sourceItem, definition, contextText)) return;
        if (nextItems.length + mention.count - 1 > maxItems) return;
        const expanded = Array.from({ length: mention.count }, (_, index) => ({
          ...sourceItem,
          title: `${mention.label} ${index + 1}`,
        }));
        nextItems = [
          ...nextItems.slice(0, itemIndex),
          ...expanded,
          ...nextItems.slice(itemIndex + 1),
        ];
        return;
      }

      if (matchingIndices.length > 1 && hasDuplicateTitles(nextItems, matchingIndices)) {
        nextItems = numberMatchingItems(nextItems, matchingIndices, mention.label);
      }
    });

    return nextItems;
  }

  return {
    MVP_MAX_QUANTITY,
    applyExplicitItemQuantities,
    extractExplicitItemQuantities,
    parseQuantityToken,
  };
});
