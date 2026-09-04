const GROUP_PARTICIPANT_PREFIX = "group-participant-";
const MATERIAL_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MATERIAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class GroupTripActionError extends Error {
  constructor(code, status) {
    super(code);
    this.name = "GroupTripActionError";
    this.code = code;
    this.status = status;
  }
}

function actionError(code, status) {
  throw new GroupTripActionError(code, status);
}

function isGroupTripState(state) {
  return state?.trip?.isGroupTrip === true;
}

function hasDurableEmailIdentity(user = null) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  return Boolean(
    user?.id
    && user?.is_anonymous !== true
    && identities.some((identity) => identity?.provider === "email"),
  );
}

function normalizeProgramText(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 4000);
}

function normalizeProgramInfo(value = {}, fallbackCurrency = "RUB") {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const amount = ["", null, undefined].includes(input.priceAmount) ? 0 : Number(input.priceAmount);
  const fallback = /^[A-Z]{3}$/.test(String(fallbackCurrency || "").toUpperCase())
    ? String(fallbackCurrency).toUpperCase()
    : "RUB";
  const currency = String(input.priceCurrency || fallback).trim().toUpperCase();
  return {
    priceAmount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0,
    priceCurrency: /^[A-Z]{3}$/.test(currency) ? currency : fallback,
    includedText: normalizeProgramText(input.includedText),
    notIncludedText: normalizeProgramText(input.notIncludedText),
    importantInfoText: normalizeProgramText(input.importantInfoText),
  };
}

function normalizeGroupMaterials(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 40).reduce((materials, entry) => {
    const input = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
    const id = String(input.id || "").trim().toLowerCase();
    const fileName = String(input.fileName || input.file_name || "").trim();
    const mimeType = String(input.mimeType || input.mime_type || "").trim().toLowerCase();
    const fileSizeBytes = Number(input.fileSizeBytes ?? input.file_size_bytes);
    const createdAt = new Date(String(input.createdAt || input.created_at || ""));
    if (!MATERIAL_UUID_PATTERN.test(id) || !fileName || fileName.length > 255 || /[\u0000-\u001F\u007F]/.test(fileName)) return materials;
    if (!MATERIAL_MIME_TYPES.has(mimeType)) return materials;
    if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > 10 * 1024 * 1024) return materials;
    if (!Number.isFinite(createdAt.getTime()) || seen.has(id)) return materials;
    seen.add(id);
    materials.push({ id, fileName, mimeType, fileSizeBytes, createdAt: createdAt.toISOString() });
    return materials;
  }, []);
}

function stripOrganizerFields(state) {
  if (!state?.trip) return state;
  delete state.trip.programInfo;
  delete state.trip.groupMaterials;
  delete state.trip.programUpdatedAt;
  return state;
}

function getComparableProgramState(state) {
  const comparable = JSON.parse(JSON.stringify(state || {}));
  if (comparable?.trip) delete comparable.trip.programUpdatedAt;
  return comparable;
}

function stampPublishedProgramState(state, previousState = null, now = new Date()) {
  if (!state?.trip) return state;
  if (!isGroupTripState(state)) return stripOrganizerFields(state);
  state.trip.programInfo = normalizeProgramInfo(state.trip.programInfo, state.trip.currency);
  state.trip.groupMaterials = normalizeGroupMaterials(state.trip.groupMaterials);
  const previousTimestamp = String(previousState?.trip?.programUpdatedAt || "");
  const unchanged = isGroupTripState(previousState)
    && JSON.stringify(getComparableProgramState(previousState)) === JSON.stringify(getComparableProgramState(state));
  state.trip.programUpdatedAt = unchanged && Number.isFinite(Date.parse(previousTimestamp))
    ? new Date(previousTimestamp).toISOString()
    : new Date(now).toISOString();
  return state;
}

function prepareTripShareWrite({ state, includeBudget = true, user, stripBudget, previousState = null, now = new Date() }) {
  if (!state || typeof state !== "object" || Array.isArray(state)) actionError("state_required", 400);
  const isGroupTrip = isGroupTripState(state);
  if (isGroupTrip && !hasDurableEmailIdentity(user)) actionError("durable_identity_required", 403);
  const effectiveIncludeBudget = isGroupTrip ? false : includeBudget !== false;
  const preparedState = effectiveIncludeBudget ? structuredClone(state) : stripBudget(state);
  stampPublishedProgramState(preparedState, previousState, now);
  return {
    includeBudget: effectiveIncludeBudget,
    isGroupTrip,
    state: preparedState,
  };
}

function createParticipantId(randomUuid = () => crypto.randomUUID()) {
  return `${GROUP_PARTICIPANT_PREFIX}${randomUuid()}`;
}

async function joinGroupTrip({ shareId, user, store, randomUuid = undefined }) {
  if (!hasDurableEmailIdentity(user)) actionError("durable_identity_required", 403);
  if (!shareId) actionError("share_id_required", 400);
  const share = await store.getShare(shareId);
  if (!share) actionError("share_not_found", 404);
  if (share.revoked_at) actionError("share_revoked", 410);
  if (!isGroupTripState(share.state)) actionError("group_trip_required", 409);
  if (share.owner_user_id === user.id) actionError("owner_cannot_join", 409);
  const displayName = await store.getDisplayName(user.id);
  if (!displayName) actionError("profile_required", 409);

  let participantLink = await store.getParticipantLink(share.id, user.id, share.mode_epoch);
  if (!participantLink) {
    await store.ensureParticipantLink({
      tripShareId: share.id,
      participantId: createParticipantId(randomUuid),
      userId: user.id,
    });
    participantLink = await store.getParticipantLink(share.id, user.id, share.mode_epoch);
  }
  if (!participantLink?.participant_id) actionError("join_failed", 500);
  await store.ensureReceivedRelation({ tripShareId: share.id, userId: user.id });
  return {
    ok: true,
    shareId: share.id,
    participantId: participantLink.participant_id,
    displayName,
  };
}

async function getOrganizerGroupContext({ tripId, user, store }) {
  if (!hasDurableEmailIdentity(user)) actionError("durable_identity_required", 403);
  if (!tripId) actionError("trip_id_required", 400);
  const share = await store.getOwnerShare(tripId, user.id);
  if (!share) actionError("share_not_found", 404);
  if (share.revoked_at) actionError("share_revoked", 410);
  if (!isGroupTripState(share.state)) actionError("group_trip_required", 409);
  const links = await store.listParticipantLinks(share.id, share.mode_epoch);
  const profileNames = await store.getDisplayNames(links.map((link) => link.user_id));
  return {
    ok: true,
    shareId: share.id,
    participantCount: links.length,
    participants: links.map((link) => ({ displayName: profileNames.get(link.user_id) || "" })),
  };
}

export {
  GROUP_PARTICIPANT_PREFIX,
  GroupTripActionError,
  getOrganizerGroupContext,
  hasDurableEmailIdentity,
  isGroupTripState,
  joinGroupTrip,
  normalizeGroupMaterials,
  normalizeProgramInfo,
  prepareTripShareWrite,
  stampPublishedProgramState,
  stripOrganizerFields,
};
