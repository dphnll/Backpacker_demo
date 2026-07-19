const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTravelIdeaArchivePatch,
  buildTravelIdeaCollectionInsertPayload,
  buildTravelIdeaEditablePatch,
  buildTravelIdeaInsertPayload,
  filterInboxTravelIdeas,
  mapTravelIdeaRowToViewModel,
  mapTravelIdeaToTripItemDraft,
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

test("All ideas view shows every inbox idea and hides archived rows", () => {
  const ideas = [
    { id: "1", title: "Inbox without collection", status: "inbox", collection_id: null },
    { id: "2", title: "Inbox in collection", status: "inbox", collection_id: COLLECTION_ID },
    { id: "3", title: "Archived", status: "archived", collection_id: COLLECTION_ID },
  ];

  assert.deepEqual(filterInboxTravelIdeas(ideas, "all").map((idea) => idea.id), ["1", "2"]);
});

test("Ungrouped view shows only ideas without collection_id", () => {
  const ideas = [
    { id: "1", title: "No collection", status: "inbox", collection_id: null },
    { id: "2", title: "Missing collection", status: "inbox" },
    { id: "3", title: "Collection", status: "inbox", collection_id: COLLECTION_ID },
  ];

  assert.deepEqual(filterInboxTravelIdeas(ideas, "ungrouped").map((idea) => idea.id), ["1", "2"]);
});

test("collection view shows only the selected collection_id", () => {
  const otherCollectionId = "650e8400-e29b-41d4-a716-446655440001";
  const ideas = [
    { id: "1", title: "Georgia", status: "inbox", collection_id: COLLECTION_ID },
    { id: "2", title: "Serbia", status: "inbox", collection_id: otherCollectionId },
    { id: "3", title: "No collection", status: "inbox", collection_id: null },
  ];

  assert.deepEqual(filterInboxTravelIdeas(ideas, `collection:${COLLECTION_ID}`).map((idea) => idea.id), ["1"]);
});

test("empty collections are represented by chips through collections list, not fake ideas", () => {
  const viewModels = filterInboxTravelIdeas([], `collection:${COLLECTION_ID}`);
  assert.deepEqual(viewModels, []);
});

test("view model uses fallback image state when image is missing or broken later", () => {
  const noImage = mapTravelIdeaRowToViewModel({
    id: "idea-1",
    title: "Tea ceremony",
    semantic_type: "food",
    status: "inbox",
  }, []);
  assert.equal(noImage.hasImage, false);
  assert.equal(noImage.imageUrl, null);
  assert.equal(noImage.collectionTitle, "Без подборки");

  const withImage = mapTravelIdeaRowToViewModel({
    id: "idea-2",
    title: "Museum",
    semantic_type: "place",
    status: "inbox",
    image_url: "https://example.com/museum.jpg",
  }, []);
  assert.equal(withImage.hasImage, true);
  assert.equal(withImage.imageUrl, "https://example.com/museum.jpg");
});

test("editable patch does not overwrite source image status or owner fields", () => {
  const patch = buildTravelIdeaEditablePatch({
    title: " Updated cafe ",
    collection_id: COLLECTION_ID,
    url: "https://example.com/cafe",
    locationText: "Belgrade",
    priceAmount: "12.50",
    priceCurrency: "EUR",
    semanticType: "food",
    notes: "Nice terrace",
    source: "browser_extension",
    status: "archived",
    image_url: "https://example.com/old.jpg",
    owner_user_id: "user-2",
  });

  assert.deepEqual(patch, {
    title: "Updated cafe",
    collection_id: COLLECTION_ID,
    url: "https://example.com/cafe",
    notes: "Nice terrace",
    location_text: "Belgrade",
    price_amount: 12.5,
    price_currency: "EUR",
    semantic_type: "food",
  });
  ["source", "status", "image_url", "image_alt", "image_source", "owner_user_id"].forEach((field) => {
    assert.equal(Object.hasOwn(patch, field), false);
  });
});

test("manual create defaults source manual and status inbox", () => {
  const payload = buildTravelIdeaInsertPayload({
    title: "New idea",
    source: "",
    status: "",
  }, "user-1");

  assert.equal(payload.source, "manual");
  assert.equal(payload.status, "inbox");
});

test("TravelIdea maps to a sanitized TripItem draft", () => {
  const idea = {
    id: "idea-1",
    title: "  Wine bar  ",
    semantic_type: "food",
    url: "https://example.com/wine",
    location_text: "Tbilisi",
    notes: "Book a table",
    excerpt: "Fallback excerpt",
    price_amount: 42,
    price_currency: "GEL",
    image_url: "https://example.com/image.jpg",
    image_alt: "Wine",
    image_source: "metadata",
    source: "browser_extension",
    status: "inbox",
    collection_id: COLLECTION_ID,
    owner_user_id: "user-1",
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
    future_field: "do not copy",
  };

  const draft = mapTravelIdeaToTripItemDraft(idea, "GEL");

  assert.deepEqual(draft, {
    title: "Wine bar",
    type: "food",
    link: "https://example.com/wine",
    locationText: "Tbilisi",
    notes: "Book a table",
    price: 42,
    priceWarning: "",
  });
  ["image_url", "image_alt", "image_source", "source", "status", "collection_id", "owner_user_id", "created_at", "updated_at", "future_field"].forEach((field) => {
    assert.equal(Object.hasOwn(draft, field), false);
  });
});

test("TravelIdea draft uses excerpt only when notes are empty", () => {
  assert.equal(mapTravelIdeaToTripItemDraft({ title: "Museum", notes: "Own notes", excerpt: "Excerpt" }, "RUB").notes, "Own notes");
  assert.equal(mapTravelIdeaToTripItemDraft({ title: "Museum", notes: "   ", excerpt: "Excerpt" }, "RUB").notes, "Excerpt");
});

test("TravelIdea draft price requires explicit matching currency", () => {
  const matching = mapTravelIdeaToTripItemDraft({
    title: "Museum",
    price_amount: 1500,
    price_currency: "RUB",
  }, "RUB");
  assert.equal(matching.price, 1500);
  assert.equal(matching.priceWarning, "");

  const missing = mapTravelIdeaToTripItemDraft({
    title: "Museum",
    price_amount: 1500,
  }, "RUB");
  assert.equal(missing.price, 0);
  assert.equal(missing.priceWarning, "Валюта цены не указана. Цена не перенесена в карточку поездки.");

  const mismatched = mapTravelIdeaToTripItemDraft({
    title: "Museum",
    price_amount: 1500,
    price_currency: "EUR",
  }, "RUB");
  assert.equal(mismatched.price, 0);
  assert.equal(mismatched.priceWarning, "В идее цена указана в другой валюте. Цена не перенесена в карточку поездки.");
});

test("TravelIdea mapping is immutable and repeatable", () => {
  const idea = Object.freeze({
    title: "Reusable place",
    semantic_type: "place",
    url: "https://example.com/place",
    price_amount: 10,
    price_currency: "USD",
  });
  const first = mapTravelIdeaToTripItemDraft(idea, "USD");
  const second = mapTravelIdeaToTripItemDraft(idea, "USD");

  assert.deepEqual(first, second);
  assert.equal(first.price, 10);
});
