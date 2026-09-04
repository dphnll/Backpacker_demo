const GROUP_PARTICIPANT_PREFIX = "group-participant-";

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

function prepareTripShareWrite({ state, includeBudget = true, user, stripBudget }) {
  if (!state || typeof state !== "object" || Array.isArray(state)) actionError("state_required", 400);
  const isGroupTrip = isGroupTripState(state);
  if (isGroupTrip && !hasDurableEmailIdentity(user)) actionError("durable_identity_required", 403);
  const effectiveIncludeBudget = isGroupTrip ? false : includeBudget !== false;
  return {
    includeBudget: effectiveIncludeBudget,
    isGroupTrip,
    state: effectiveIncludeBudget ? state : stripBudget(state),
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
  prepareTripShareWrite,
};
