const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MVP_MAX_QUANTITY,
  applyExplicitItemQuantities,
  extractExplicitItemQuantities,
} = require("../trip-draft-quantity-core.js");

function item(title, overrides = {}) {
  return {
    title,
    type: "food",
    status: "want",
    priority: "nice",
    date: "",
    notes: "",
    locationText: "",
    ...overrides,
  };
}

function quantityFor(text, kind) {
  return extractExplicitItemQuantities(text).find((entry) => entry.kind === kind)?.count || 0;
}

test("две кофейни maps to 2", () => {
  assert.equal(quantityFor("Хочу две кофейни", "cafe"), 2);
});

test("пара кафе maps to 2", () => {
  assert.equal(quantityFor("Нужна пара кафе", "cafe"), 2);
});

test("несколько ресторанов maps to 3", () => {
  assert.equal(quantityFor("Хочу несколько хороших ресторанов", "restaurant"), 3);
});

test("3 музея maps to 3", () => {
  assert.equal(quantityFor("Посетить 3 музея", "museum"), 3);
});

test("3–4 музея uses the upper bound", () => {
  assert.equal(quantityFor("Хочу 3–4 музея", "museum"), 4);
});

test("a quantity does not cross a conjunction into the next item category", () => {
  const mentions = extractExplicitItemQuantities("Один музей, две кофейни и баню");
  assert.deepEqual(mentions.map(({ kind, count }) => ({ kind, count })), [
    { kind: "museum", count: 1 },
    { kind: "cafe", count: 2 },
  ]);
});

test("a model result with the expected count is not expanded again", () => {
  const items = [item("Кофейня у Кремля"), item("Кофейня на Баумана")];
  const result = applyExplicitItemQuantities("Хочу две кофейни", items);
  assert.equal(result.length, 2);
  assert.deepEqual(result, items);
});

test("different meaningful model titles are preserved", () => {
  const items = [item("Музей современного искусства"), item("Национальный музей"), item("Археологический музей")];
  const result = applyExplicitItemQuantities("Хочу 3 музея", items);
  assert.deepEqual(result.map((entry) => entry.title), items.map((entry) => entry.title));
});

test("the expected number of typed cards prevents double expansion without category words", () => {
  const items = [
    item("Музей", { type: "excursion" }),
    item("Topkapı Palace", { type: "place" }),
    item("Istanbul Modern", { type: "place" }),
    item("Archaeology collection", { type: "excursion" }),
  ];
  const result = applyExplicitItemQuantities("Хочу 3–4 музея", items);
  assert.equal(result.length, 4);
  assert.deepEqual(result, items);
});

test("one generalized item expands to neutrally numbered cards", () => {
  const result = applyExplicitItemQuantities("Хочу две кофейни", [item("Кофейни")]);
  assert.deepEqual(result.map((entry) => entry.title), ["Кофейня 1", "Кофейня 2"]);
  assert.ok(result.every((entry) => entry.date === ""));
});

test("generic model titles with the trip destination expand safely", () => {
  const result = applyExplicitItemQuantities(
    "Планирую поездку в Стамбул, хочу 3–4 музея и несколько хороших ресторанов",
    [
      item("Подобрать 3–4 музея в Стамбуле", { type: "excursion" }),
      item("Подобрать несколько хороших ресторанов в Стамбуле"),
    ],
    { contextText: "Стамбул" },
  );
  assert.deepEqual(result.map((entry) => entry.title), [
    "Музей 1", "Музей 2", "Музей 3", "Музей 4",
    "Ресторан 1", "Ресторан 2", "Ресторан 3",
  ]);
});

test("duplicate titles at the expected count get neutral numbering", () => {
  const result = applyExplicitItemQuantities("Хочу пара кафе", [item("Кафе"), item("Кафе")]);
  assert.deepEqual(result.map((entry) => entry.title), ["Кафе 1", "Кафе 2"]);
});

test("an unclear source-to-model match is not expanded", () => {
  const items = [item("Ужин с видом", { type: "food" })];
  const result = applyExplicitItemQuantities("Хочу две кофейни", items);
  assert.equal(result, items);
});

test("post-processing is idempotent", () => {
  const first = applyExplicitItemQuantities("Хочу несколько ресторанов", [item("Рестораны")]);
  const second = applyExplicitItemQuantities("Хочу несколько ресторанов", first);
  assert.deepEqual(second, first);
  assert.deepEqual(second.map((entry) => entry.title), ["Ресторан 1", "Ресторан 2", "Ресторан 3"]);
});

test("quantities above the MVP limit are not expanded", () => {
  assert.equal(MVP_MAX_QUANTITY, 6);
  const items = [item("Музеи", { type: "excursion" })];
  assert.equal(applyExplicitItemQuantities("Хочу 20 музеев", items), items);
});
