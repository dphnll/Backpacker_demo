(function initPrivateTripSyncClient(root) {
  "use strict";

  const core = typeof module !== "undefined" && module.exports
    ? require("./private-trip-sync-core.js")
    : root.BackpackerPrivateTripSync;

  const SNAPSHOT_COLUMNS = "trip_id, snapshot, sync_token, client_updated_at, deleted_at";

  function clientError(error, fallback) {
    const wrapped = new Error(error?.message || fallback);
    wrapped.code = error?.code || fallback;
    wrapped.status = error?.status || error?.statusCode || 0;
    return wrapped;
  }

  function assertClient(client) {
    if (!client?.from) throw clientError(null, "supabase_not_configured");
  }

  async function listPrivateTripSnapshots(client) {
    assertClient(client);
    const result = await client
      .from(core.PRIVATE_TRIP_SNAPSHOTS_TABLE)
      .select(SNAPSHOT_COLUMNS)
      .order("updated_at", { ascending: true });
    if (result?.error) throw clientError(result.error, "trip_sync_list_failed");
    return (result?.data || []).map(core.normalizeRemoteTripRow);
  }

  async function insertPrivateTripSnapshot(client, entry, syncToken) {
    assertClient(client);
    const payload = core.createTripUploadPayload(entry, syncToken);
    const result = await client
      .from(core.PRIVATE_TRIP_SNAPSHOTS_TABLE)
      .insert(payload)
      .select(SNAPSHOT_COLUMNS)
      .single();
    if (result?.error) throw clientError(result.error, "trip_sync_insert_failed");
    return core.normalizeRemoteTripRow(result.data);
  }

  async function updatePrivateTripSnapshot(client, entry, expectedSyncToken, nextSyncToken) {
    assertClient(client);
    const payload = core.createTripUploadPayload(entry, nextSyncToken);
    const result = await client
      .from(core.PRIVATE_TRIP_SNAPSHOTS_TABLE)
      .update({ ...payload, deleted_at: null })
      .eq("trip_id", payload.trip_id)
      .eq("sync_token", String(expectedSyncToken || "").toLowerCase())
      .select(SNAPSHOT_COLUMNS)
      .maybeSingle();
    if (result?.error) throw clientError(result.error, "trip_sync_update_failed");
    if (!result?.data) throw clientError(null, "trip_sync_conflict");
    return core.normalizeRemoteTripRow(result.data);
  }

  async function tombstonePrivateTripSnapshot(client, tripId, expectedSyncToken, nextSyncToken) {
    assertClient(client);
    const result = await client
      .from(core.PRIVATE_TRIP_SNAPSHOTS_TABLE)
      .update({
        deleted_at: new Date().toISOString(),
        sync_token: String(nextSyncToken || "").toLowerCase(),
      })
      .eq("trip_id", String(tripId || ""))
      .eq("sync_token", String(expectedSyncToken || "").toLowerCase())
      .select(SNAPSHOT_COLUMNS)
      .maybeSingle();
    if (result?.error) throw clientError(result.error, "trip_sync_delete_failed");
    if (!result?.data) throw clientError(null, "trip_sync_conflict");
    return core.normalizeRemoteTripRow(result.data);
  }

  const api = {
    SNAPSHOT_COLUMNS,
    insertPrivateTripSnapshot,
    listPrivateTripSnapshots,
    tombstonePrivateTripSnapshot,
    updatePrivateTripSnapshot,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BackpackerPrivateTripSyncClient = api;
})(typeof window !== "undefined" ? window : globalThis);
