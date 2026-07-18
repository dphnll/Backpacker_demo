const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTravelIdeaArchivePatch,
  buildTravelIdeaCollectionInsertPayload,
  buildTravelIdeaInsertPayload,
  mapManualIdeaToTravelIdea,
  mapTravelCandidateToTravelIdea,
  normalizeTravelIdeaCollectionId,
  normalizeTravelIdeaSource,
  normalizeTravelIdeaStatus,
  normalizeTravelIdeaType,
} = require("../travel-idea-core.js");

const COLLECTION_ID = "550e8400-e29b-41d4-a716-446655440000";

test("manual input maps without url image or price", () => {
  const idea = mapManualIdeaToTravelIdea({
    title: "  Баня вечером  ",
    notes: "посмотреть рядом с отелем",
  });

  assert.deepEqual(idea, {
    title: "Баня вечером",
    notes: "посмотреть рядом с отелем",
    semantic_type: "idea",
    source: "manual",
    status: "inbox",
  });
});

test("TravelCandidate maps title url excerpt location price image and source", () => {
  const idea = mapTravelCandidateToTravelIdea({
    sourceType: "link_intake",
    fields: {
      title: "Kazan Hammam",
      sourceUrl: "https://example.com/hammam",
      description: "Spa and bathhouse near the center.",
      location: "Kazan center",
      price: { amount: 2500, currency: "RUB", kind: "exact" },
      image: "https://example.com/hammam.jpg",
    },
    provenance: {
      image: { source: "metadata" },
    },
  });

  assert.deepEqual(idea, {
    title: "Kazan Hammam",
    url: "https://example.com/hammam",
    excerpt: "Spa and bathhouse near the center.",
    location_text: "Kazan center",
    price_amount: 2500,
    price_currency: "RUB",
    semantic_type: "idea",
    source: "link_intake",
    status: "inbox",
    image_url: "https://example.com/hammam.jpg",
    image_source: "metadata",
  });
});

test("TravelCandidate does not require image", () => {
  const idea = mapTravelCandidateToTravelIdea({
    sourceType: "browser_extension",
    fields: {
      title: "Coffee place",
      sourceUrl: "https://example.com/coffee",
    },
  });

  assert.equal(idea.title, "Coffee place");
  assert.equal(idea.source, "browser_extension");
  assert.equal(Object.hasOwn(idea, "image_url"), false);
});

test("idea without collection_id is valid", () => {
  const payload = buildTravelIdeaInsertPayload({
    title: "Asia ideas",
  }, "user-1");

  assert.equal(payload.title, "Asia ideas");
  assert.equal(Object.hasOwn(payload, "collection_id"), false);
});

test("idea with collection_id preserves UUID", () => {
  const payload = buildTravelIdeaInsertPayload({
    title: "Georgia wine bar",
    collection_id: COLLECTION_ID.toUpperCase(),
  }, "user-1");

  assert.equal(payload.collection_id, COLLECTION_ID);
});

test("invalid collection_id is cleared predictably", () => {
  assert.equal(normalizeTravelIdeaCollectionId("not-a-uuid"), null);

  const idea = mapManualIdeaToTravelIdea({
    title: "Serbia cafe",
    collection_id: "not-a-uuid",
  });

  assert.equal(Object.hasOwn(idea, "collection_id"), false);
});

test("manual mapper accepts collection_id", () => {
  const idea = mapManualIdeaToTravelIdea({
    title: "China route",
    collectionId: COLLECTION_ID,
  });

  assert.equal(idea.collection_id, COLLECTION_ID);
});

test("TravelCandidate mapper accepts collection_id through options", () => {
  const idea = mapTravelCandidateToTravelIdea({
    sourceType: "link_intake",
    fields: {
      title: "Buenos Aires museum",
      sourceUrl: "https://example.com/museum",
    },
  }, {
    collection_id: COLLECTION_ID,
  });

  assert.equal(idea.collection_id, COLLECTION_ID);
  assert.equal(idea.title, "Buenos Aires museum");
});

test("TravelIdea output does not create TripItem fields", () => {
  const payload = buildTravelIdeaInsertPayload({
    title: "Museum",
    type: "place",
    status: "paid",
    date: "2026-08-01",
    startTime: "10:00",
    durationMinutes: 120,
    paidAmount: 100,
    allocations: [{ participantId: "p1", amount: 100 }],
    order: 1,
    tripId: "trip-1",
    tripItemId: "item-1",
    added_to_trip_id: "trip-1",
    added_to_trip_item_id: "item-1",
  }, "user-1");

  assert.equal(payload.owner_user_id, "user-1");
  assert.equal(payload.title, "Museum");
  assert.equal(payload.semantic_type, "place");
  assert.equal(payload.status, "inbox");
  ["date", "startTime", "durationMinutes", "paidAmount", "allocations", "order", "priority", "tripId", "tripItemId", "added_to_trip_id", "added_to_trip_item_id"].forEach((field) => {
    assert.equal(Object.hasOwn(payload, field), false);
  });
});

test("invalid status source and type are handled safely", () => {
  assert.equal(normalizeTravelIdeaStatus("paid"), "inbox");
  assert.equal(normalizeTravelIdeaStatus("added_to_trip"), "inbox");
  assert.equal(normalizeTravelIdeaSource("extension-v2"), "manual");
  assert.equal(normalizeTravelIdeaType("concert"), "idea");

  const payload = buildTravelIdeaInsertPayload({
    title: "Odd thing",
    semantic_type: "concert",
    source: "extension-v2",
    status: "deleted",
  }, "user-1");

  assert.equal(payload.semantic_type, "idea");
  assert.equal(payload.source, "manual");
  assert.equal(payload.status, "inbox");
});

test("archive returns a soft archive update patch", () => {
  assert.deepEqual(buildTravelIdeaArchivePatch(), { status: "archived" });
});

test("TravelIdea remains reusable as an independent source", () => {
  const payload = buildTravelIdeaInsertPayload({
    title: "Reusable museum idea",
    url: "https://example.com/museum",
  }, "user-1");

  assert.equal(payload.status, "inbox");
  assert.equal(Object.hasOwn(payload, "added_to_trip_id"), false);
  assert.equal(Object.hasOwn(payload, "added_to_trip_item_id"), false);
});

test("collection title is required and trimmed", () => {
  assert.equal(buildTravelIdeaCollectionInsertPayload({ title: "   " }, "user-1"), null);

  const payload = buildTravelIdeaCollectionInsertPayload({
    title: "  Азия — пока не решила куда  ",
  }, "user-1");

  assert.deepEqual(payload, {
    owner_user_id: "user-1",
    title: "Азия — пока не решила куда",
    sort_order: 0,
  });
});

test("collection payload contains owner title and sort_order", () => {
  const payload = buildTravelIdeaCollectionInsertPayload({
    title: "Грузия",
    sortOrder: "7.8",
  }, "user-1");

  assert.deepEqual(payload, {
    owner_user_id: "user-1",
    title: "Грузия",
    sort_order: 7,
  });
});
