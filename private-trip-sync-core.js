(function initPrivateTripSyncCore(root) {
  "use strict";

  const PRIVATE_TRIP_SNAPSHOTS_TABLE = "private_trip_snapshots";
  const PRIVATE_TRIP_SYNC_SCHEMA_VERSION = 1;
  const MAX_SNAPSHOT_BYTES = 3 * 1024 * 1024;
  const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function syncError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function stableSerialize(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function fingerprintTripEntry(entry) {
    const source = stableSerialize(entry);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function normalizeTripId(value) {
    const tripId = String(value || "").trim();
    if (!TRIP_ID_PATTERN.test(tripId) || tripId === "trainer-kazan") throw syncError("trip_sync_id_invalid");
    return tripId;
  }

  function normalizeSyncToken(value) {
    const token = String(value || "").trim().toLowerCase();
    if (!UUID_PATTERN.test(token)) throw syncError("trip_sync_token_invalid");
    return token;
  }

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      throw syncError("trip_sync_snapshot_invalid");
    }
  }

  function normalizeTripEntry(value) {
    const entry = cloneJson(value);
    const tripId = normalizeTripId(entry?.id);
    if (entry?.isDemo === true || entry?.state?.trip?.id !== tripId || !Array.isArray(entry?.state?.items)) {
      throw syncError("trip_sync_snapshot_invalid");
    }
    const serialized = JSON.stringify(entry);
    if (new TextEncoder().encode(serialized).byteLength > MAX_SNAPSHOT_BYTES) {
      throw syncError("trip_sync_snapshot_too_large");
    }
    return entry;
  }

  function normalizeRemoteTripRow(row = {}) {
    const tripId = normalizeTripId(row.trip_id ?? row.tripId);
    const syncToken = normalizeSyncToken(row.sync_token ?? row.syncToken);
    const deletedAt = String((row.deleted_at ?? row.deletedAt) || "");
    const entry = deletedAt ? null : normalizeTripEntry(row.snapshot);
    if (entry && entry.id !== tripId) throw syncError("trip_sync_snapshot_invalid");
    return {
      clientUpdatedAt: String((row.client_updated_at ?? row.clientUpdatedAt) || ""),
      deletedAt,
      entry,
      syncToken,
      tripId,
    };
  }

  function createTripUploadPayload(entry, syncToken) {
    const normalized = normalizeTripEntry(entry);
    return {
      client_updated_at: String(normalized.updatedAt || new Date().toISOString()),
      schema_version: PRIVATE_TRIP_SYNC_SCHEMA_VERSION,
      snapshot: normalized,
      sync_token: normalizeSyncToken(syncToken),
      trip_id: normalized.id,
    };
  }

  function decideTripReconciliation({ localEntry = null, remoteRow = null, metadata = null } = {}) {
    const local = localEntry ? normalizeTripEntry(localEntry) : null;
    const remote = remoteRow ? normalizeRemoteTripRow(remoteRow) : null;
    if (!local && !remote) return { action: "none" };
    if (local && !remote) return { action: "upload_local" };
    if (!local && remote?.deletedAt) return { action: "remember_deleted" };
    if (!local && remote?.entry) return { action: "import_remote" };

    const localFingerprint = fingerprintTripEntry(local);
    const lastFingerprint = String(metadata?.lastFingerprint || "");
    const lastSyncToken = String(metadata?.syncToken || "").toLowerCase();
    if (remote.deletedAt) {
      if (lastSyncToken === remote.syncToken && lastFingerprint === localFingerprint) {
        return { action: "remove_local" };
      }
      return { action: "fork_local_and_remove" };
    }

    const remoteFingerprint = fingerprintTripEntry(remote.entry);
    if (localFingerprint === remoteFingerprint) return { action: "in_sync" };
    if (lastSyncToken === remote.syncToken) return { action: "upload_local" };
    if (lastFingerprint && lastFingerprint === localFingerprint) return { action: "import_remote" };
    return { action: "fork_local_and_import" };
  }

  function createConflictCopy(entry, nextTripId) {
    const copy = normalizeTripEntry(entry);
    const tripId = normalizeTripId(nextTripId);
    copy.id = tripId;
    copy.state.trip.id = tripId;
    copy.state.trip.title = `${String(copy.state.trip.title || "Поездка").trim()} — копия с этого устройства`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    return copy;
  }

  const api = {
    MAX_SNAPSHOT_BYTES,
    PRIVATE_TRIP_SNAPSHOTS_TABLE,
    PRIVATE_TRIP_SYNC_SCHEMA_VERSION,
    createConflictCopy,
    createTripUploadPayload,
    decideTripReconciliation,
    fingerprintTripEntry,
    normalizeRemoteTripRow,
    normalizeTripEntry,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BackpackerPrivateTripSync = api;
})(typeof window !== "undefined" ? window : globalThis);
