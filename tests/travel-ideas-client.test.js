const assert = require("node:assert/strict");
const test = require("node:test");

const {
  archiveTravelIdea,
  fetchInboxTravelIdeas,
  fetchTravelIdeaCollections,
  insertTravelIdea,
  insertTravelIdeaCollection,
  updateTravelIdea,
} = require("../travel-ideas-client.js");

class FakeQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.action = "";
    this.payload = null;
    this.filters = [];
    this.orders = [];
    this.singleCalled = false;
  }

  select(columns) {
    if (!this.action) this.action = "select";
    this.columns = columns;
    return this;
  }

  insert(payload) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(patch) {
    this.action = "update";
    this.payload = patch;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  order(column, options) {
    this.orders.push({ column, options });
    return this;
  }

  single() {
    this.singleCalled = true;
    return this;
  }

  then(resolve, reject) {
    const call = {
      action: this.action || "select",
      columns: this.columns,
      filters: this.filters,
      orders: this.orders,
      payload: this.payload,
      single: this.singleCalled,
      table: this.table,
    };
    this.client.calls.push(call);
    const response = this.client.responses.shift() || { data: null, error: null };
    return Promise.resolve(response).then(resolve, reject);
  }
}

class FakeSupabaseClient {
  constructor(responses = []) {
    this.calls = [];
    this.responses = [...responses];
    this.deleteCalled = false;
  }

  from(table) {
    return new FakeQuery(this, table);
  }

  delete() {
    this.deleteCalled = true;
    throw new Error("delete must not be called");
  }
}

test("collections select orders by sort_order then created_at", async () => {
  const client = new FakeSupabaseClient([{ data: [{ id: "collection-1" }], error: null }]);
  const result = await fetchTravelIdeaCollections(client);

  assert.deepEqual(result, [{ id: "collection-1" }]);
  assert.deepEqual(client.calls[0], {
    action: "select",
    columns: "*",
    filters: [],
    orders: [
      { column: "sort_order", options: { ascending: true } },
      { column: "created_at", options: { ascending: true } },
    ],
    payload: null,
    single: false,
    table: "travel_idea_collections",
  });
});

test("ideas select only inbox and order by created_at desc", async () => {
  const client = new FakeSupabaseClient([{ data: [{ id: "idea-1" }], error: null }]);
  const result = await fetchInboxTravelIdeas(client);

  assert.deepEqual(result, [{ id: "idea-1" }]);
  assert.equal(client.calls[0].table, "travel_ideas");
  assert.deepEqual(client.calls[0].filters, [{ column: "status", value: "inbox" }]);
  assert.deepEqual(client.calls[0].orders, [{ column: "created_at", options: { ascending: false } }]);
});

test("create collection inserts payload and returns row", async () => {
  const payload = { owner_user_id: "user-1", title: "Грузия", sort_order: 0 };
  const client = new FakeSupabaseClient([{ data: { id: "collection-1", ...payload }, error: null }]);
  const result = await insertTravelIdeaCollection(client, payload);

  assert.equal(result.id, "collection-1");
  assert.equal(client.calls[0].table, "travel_idea_collections");
  assert.equal(client.calls[0].action, "insert");
  assert.deepEqual(client.calls[0].payload, payload);
  assert.equal(client.calls[0].single, true);
});

test("create manual idea inserts domain payload without TripItem fields", async () => {
  const payload = { owner_user_id: "user-1", title: "Museum", source: "manual", status: "inbox" };
  const client = new FakeSupabaseClient([{ data: { id: "idea-1", ...payload }, error: null }]);
  const result = await insertTravelIdea(client, payload);

  assert.equal(result.id, "idea-1");
  assert.equal(client.calls[0].table, "travel_ideas");
  assert.equal(client.calls[0].action, "insert");
  assert.deepEqual(client.calls[0].payload, payload);
  ["trip_id", "trip_item_id", "date", "order", "allocations"].forEach((field) => {
    assert.equal(Object.hasOwn(client.calls[0].payload, field), false);
  });
});

test("update sends only editable patch", async () => {
  const patch = { title: "Updated", notes: "Keep source and image", collection_id: null };
  const client = new FakeSupabaseClient([{ data: { id: "idea-1", ...patch }, error: null }]);
  await updateTravelIdea(client, "idea-1", patch);

  assert.equal(client.calls[0].table, "travel_ideas");
  assert.equal(client.calls[0].action, "update");
  assert.deepEqual(client.calls[0].payload, patch);
  assert.deepEqual(client.calls[0].filters, [{ column: "id", value: "idea-1" }]);
  ["source", "status", "image_url", "image_alt", "image_source"].forEach((field) => {
    assert.equal(Object.hasOwn(client.calls[0].payload, field), false);
  });
});

test("archive sends only status archived and never deletes", async () => {
  const client = new FakeSupabaseClient([{ data: { id: "idea-1", status: "archived" }, error: null }]);
  await archiveTravelIdea(client, "idea-1");

  assert.deepEqual(client.calls[0].payload, { status: "archived" });
  assert.equal(client.calls[0].action, "update");
  assert.equal(client.deleteCalled, false);
});
