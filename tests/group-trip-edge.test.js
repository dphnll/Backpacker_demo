const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const modulePath = pathToFileURL(path.join(__dirname, "..", "supabase", "functions", "trip-share", "group-trips.mjs")).href;
const durableUser = (id) => ({ id, is_anonymous: false, identities: [{ provider: "email" }] });
const anonymousUser = (id) => ({ id, is_anonymous: true, identities: [{ provider: "anonymous" }] });

class MemoryStore {
  constructor(share, names = new Map()) {
    this.share = share;
    this.names = names;
    this.links = [];
    this.recipients = [];
  }
  async getShare(id) { return this.share?.id === id ? this.share : null; }
  async getOwnerShare(tripId, userId) {
    return this.share?.trip_id === tripId && this.share?.owner_user_id === userId ? this.share : null;
  }
  async getDisplayName(id) { return this.names.get(id) || ""; }
  async getDisplayNames(ids) { return new Map(ids.map((id) => [id, this.names.get(id) || ""])); }
  async getParticipantLink(shareId, userId) {
    return this.links.find((entry) => entry.trip_share_id === shareId && entry.user_id === userId) || null;
  }
  async ensureParticipantLink({ tripShareId, participantId, userId }) {
    if (!await this.getParticipantLink(tripShareId, userId)) {
      this.links.push({ trip_share_id: tripShareId, participant_id: participantId, user_id: userId });
    }
  }
  async ensureReceivedRelation({ tripShareId, userId }) {
    if (!this.recipients.some((entry) => entry.trip_share_id === tripShareId && entry.user_id === userId)) {
      this.recipients.push({ trip_share_id: tripShareId, user_id: userId });
    }
  }
  async listParticipantLinks(shareId) { return this.links.filter((entry) => entry.trip_share_id === shareId); }
}

test("group publish requires durable email and always strips budget", async () => {
  const { prepareTripShareWrite } = await import(modulePath);
  const state = { trip: { id: "trip-1", isGroupTrip: true, budgetLimit: 900 }, items: [{ price: 100 }] };
  const stripBudget = (input) => ({ trip: { ...input.trip, budgetLimit: 0 }, items: input.items.map(() => ({ price: 0 })) });
  assert.throws(() => prepareTripShareWrite({ state, includeBudget: true, user: anonymousUser("anon"), stripBudget }), /durable_identity_required/);
  const prepared = prepareTripShareWrite({ state, includeBudget: true, user: durableUser("owner"), stripBudget });
  assert.equal(prepared.includeBudget, false);
  assert.equal(prepared.state.trip.budgetLimit, 0);
  assert.equal(prepared.state.items[0].price, 0);

  const ordinary = prepareTripShareWrite({
    state: { trip: { id: "trip-2" }, items: [] }, includeBudget: true, user: anonymousUser("anon"), stripBudget,
  });
  assert.equal(ordinary.includeBudget, true);
});

test("join is durable, guarded, and idempotent over existing relations", async () => {
  const { joinGroupTrip } = await import(modulePath);
  const share = { id: "share-1", trip_id: "trip-1", owner_user_id: "owner", state: { trip: { isGroupTrip: true } }, revoked_at: null };
  const store = new MemoryStore(share, new Map([["member", "Ирина"]]));
  await assert.rejects(() => joinGroupTrip({ shareId: share.id, user: anonymousUser("member"), store }), /durable_identity_required/);
  await assert.rejects(() => joinGroupTrip({ shareId: share.id, user: durableUser("owner"), store }), /owner_cannot_join/);
  const first = await joinGroupTrip({ shareId: share.id, user: durableUser("member"), store, randomUuid: () => "33333333-3333-4333-8333-333333333333" });
  const second = await joinGroupTrip({ shareId: share.id, user: durableUser("member"), store, randomUuid: () => "44444444-4444-4444-8444-444444444444" });
  assert.equal(first.participantId, "group-participant-33333333-3333-4333-8333-333333333333");
  assert.equal(second.participantId, first.participantId);
  assert.equal(store.links.length, 1);
  assert.equal(store.recipients.length, 1);
});

test("join rejects revoked, non-group, and nameless users", async () => {
  const { joinGroupTrip } = await import(modulePath);
  const base = { id: "share-1", trip_id: "trip-1", owner_user_id: "owner", state: { trip: { isGroupTrip: true } }, revoked_at: null };
  await assert.rejects(() => joinGroupTrip({ shareId: base.id, user: durableUser("member"), store: new MemoryStore({ ...base, revoked_at: "now" }) }), /share_revoked/);
  await assert.rejects(() => joinGroupTrip({ shareId: base.id, user: durableUser("member"), store: new MemoryStore({ ...base, state: { trip: {} } }) }), /group_trip_required/);
  await assert.rejects(() => joinGroupTrip({ shareId: base.id, user: durableUser("member"), store: new MemoryStore(base) }), /profile_required/);
});

test("organizer context exposes participant names only", async () => {
  const { getOrganizerGroupContext } = await import(modulePath);
  const share = { id: "share-1", trip_id: "trip-1", owner_user_id: "owner", state: { trip: { isGroupTrip: true } }, revoked_at: null };
  const store = new MemoryStore(share, new Map([["member", "Alex"]]));
  store.links.push({ trip_share_id: share.id, participant_id: "private-participant", user_id: "member" });
  const result = await getOrganizerGroupContext({ tripId: "trip-1", user: durableUser("owner"), store });
  assert.deepEqual(result.participants, [{ displayName: "Alex" }]);
  assert.equal(JSON.stringify(result).includes("member"), false);
  assert.equal(JSON.stringify(result).includes("private-participant"), false);
});
