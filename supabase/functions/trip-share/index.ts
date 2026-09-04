import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVisibleBudgetFields, stripBudget } from "./privacy.mjs";
import {
  GroupTripActionError,
  getOrganizerGroupContext,
  isGroupTripState,
  joinGroupTrip,
  prepareTripShareWrite,
} from "./group-trips.mjs";
// @ts-ignore shared UMD contract initializes the same source boundary as the PWA.
import "../../../analytics-source-contract.js";
// @ts-ignore shared ESM module is executed by Deno.
import { writeSupabaseSignal } from "../_shared/analytics/supabase-source.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const SCHEMA_VERSION = "trip_share.v1";
const GROUP_MATERIAL_SCOPE_ID = "group-materials";
const GROUP_MATERIAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARTICIPANT_COLORS = ["orange", "yellow", "blue", "teal", "purple", "pink"];
const ITEM_TYPES = new Set(["ticket", "stay", "transport", "excursion", "food", "place", "spa", "shopping", "idea", "other"]);
type UserClient = ReturnType<typeof createClient<any>>;

type AnalyticsContractGlobal = typeof globalThis & {
  BackpackerAnalyticsSource?: {
    sanitizeEventProperties: (eventName: string, input: unknown) => Record<string, unknown>;
    getMissingRequiredProperties: (eventName: string, input: unknown) => string[];
  };
  EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
};

const analyticsSourceContract = (globalThis as AnalyticsContractGlobal).BackpackerAnalyticsSource;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function parseOptionalMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return { amount: null, error: "" };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return { amount: null, error: "price_invalid" };
  return { amount: Math.round(amount * 100) / 100, error: "" };
}

function normalizeParticipantName(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 40);
}

function normalizeDisplayName(value: unknown) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateDisplayName(value: unknown) {
  const displayName = normalizeDisplayName(value);
  if (!displayName) return { displayName, error: "display_name_required" };
  if (displayName.length > 40) return { displayName, error: "display_name_too_long" };
  return { displayName, error: "" };
}

function normalizeProposalText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeProposalLink(value: unknown) {
  const link = normalizeProposalText(value, 500);
  if (!link) return "";
  try {
    const url = new URL(link);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

async function getProfileDisplayName(serviceClient: UserClient, userId: string) {
  if (!userId) return "";
  const { data } = await serviceClient
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return String(data?.display_name || "");
}

async function getProfileDisplayNames(serviceClient: UserClient, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, string>();
  const { data } = await serviceClient
    .from("user_profiles")
    .select("user_id, display_name")
    .in("user_id", uniqueIds);
  return new Map((data || []).map((profile: Record<string, unknown>) => [
    String(profile.user_id || ""),
    String(profile.display_name || ""),
  ]));
}

function getTrip(state: Record<string, unknown>) {
  return (state.trip || {}) as Record<string, unknown>;
}

function getShareModeEpoch(state: Record<string, unknown>, fallback = "") {
  const value = String(getTrip(state).shareModeEpoch || fallback || "");
  return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : new Date(0).toISOString();
}

function getParticipants(state: Record<string, unknown>) {
  const trip = getTrip(state);
  return Array.isArray(trip.participants) ? trip.participants as Array<Record<string, unknown>> : [];
}

function getItems(state: Record<string, unknown>) {
  return Array.isArray(state.items) ? state.items as Array<Record<string, unknown>> : [];
}

function getSelfParticipant(state: Record<string, unknown>) {
  const participants = getParticipants(state);
  return participants.find((participant) => Boolean(participant.isSelf)) || participants[0] || null;
}

function getParticipant(state: Record<string, unknown>, participantId: string) {
  return getParticipants(state).find((participant) => String(participant.id || "") === participantId) || null;
}

function getItem(state: Record<string, unknown>, itemId: string) {
  return getItems(state).find((item) => String(item.id || "") === itemId) || null;
}

function getItemAllocations(item: Record<string, unknown>) {
  return Array.isArray(item.allocations)
    ? (item.allocations as Array<Record<string, unknown>>)
        .map((allocation) => ({
          participantId: String(allocation.participantId || ""),
          amount: parseMoney(allocation.amount),
        }))
        .filter((allocation) => allocation.participantId && allocation.amount > 0)
        .sort((a, b) => a.participantId.localeCompare(b.participantId))
    : [];
}

async function getParticipantLinkUser(serviceClient: UserClient, shareId: string, participantId: string, activeSince = "") {
  if (!participantId) return "";
  const { data } = await serviceClient
    .from("trip_share_participant_links")
    .select("user_id")
    .eq("trip_share_id", shareId)
    .eq("participant_id", participantId)
    .gte("updated_at", activeSince)
    .maybeSingle();
  return data?.user_id || "";
}

async function getFinancialVersion(
  serviceClient: UserClient,
  shareId: string,
  state: Record<string, unknown>,
  itemId: string,
  participantId: string,
) {
  const currency = String(getTrip(state).currency || "");
  const { data, error } = await serviceClient.rpc("trip_share_expense_financial_version", {
    p_trip_share_id: shareId,
    p_state: state,
    p_item_id: itemId,
    p_participant_id: participantId,
    p_currency: currency,
  });
  if (error) return "";
  return String(data || "");
}

function getAuthorAllocation(state: Record<string, unknown>, item: Record<string, unknown>) {
  const selfParticipant = getSelfParticipant(state);
  const selfId = String(selfParticipant?.id || "");
  if (!selfId) return 0;
  const allocation = getItemAllocations(item).find((entry) => entry.participantId === selfId);
  return allocation?.amount || 0;
}

function getRequesterProposalCard(proposal: Record<string, unknown>) {
  return {
    id: proposal.id,
    shareId: proposal.trip_share_id,
    itemId: proposal.item_id,
    participantMode: proposal.participant_mode,
    participantId: proposal.participant_id || "",
    proposedParticipantName: proposal.proposed_participant_name || "",
    amount: parseMoney(proposal.amount),
    currency: proposal.currency,
    status: proposal.status,
    createdAt: proposal.created_at,
    updatedAt: proposal.updated_at,
    resolvedAt: proposal.resolved_at || "",
  };
}

function getAuthorProposalCard(proposal: Record<string, unknown>, share: Record<string, unknown>, profileNames = new Map<string, string>()) {
  const state = (share.state || {}) as Record<string, unknown>;
  const item = getItem(state, String(proposal.item_id || ""));
  const participant = getParticipant(state, String(proposal.participant_id || ""));
  const requesterDisplayName = profileNames.get(String(proposal.requester_user_id || "")) || "Пользователь Backpacker";
  return {
    ...getRequesterProposalCard(proposal),
    requesterName: requesterDisplayName,
    requesterDisplayName,
    participantName: String(participant?.name || proposal.proposed_participant_name || ""),
    tripId: share.trip_id,
    itemTitle: String(item?.title || "Расход"),
    itemPrice: parseMoney(item?.price),
    authorAmount: item ? getAuthorAllocation(state, item) : 0,
  };
}

function createGroupTripStore(serviceClient: UserClient) {
  return {
    async getShare(shareId: string) {
      const { data, error } = await serviceClient
        .from("trip_shares")
        .select("id, trip_id, owner_user_id, state, revoked_at, created_at")
        .eq("id", shareId)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, mode_epoch: getShareModeEpoch(data.state, data.created_at) } : null;
    },
    async getOwnerShare(tripId: string, ownerUserId: string) {
      const { data, error } = await serviceClient
        .from("trip_shares")
        .select("id, trip_id, owner_user_id, state, revoked_at, created_at")
        .eq("trip_id", tripId)
        .eq("owner_user_id", ownerUserId)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, mode_epoch: getShareModeEpoch(data.state, data.created_at) } : null;
    },
    getDisplayName(userId: string) {
      return getProfileDisplayName(serviceClient, userId);
    },
    getDisplayNames(userIds: string[]) {
      return getProfileDisplayNames(serviceClient, userIds);
    },
    async getParticipantLink(tripShareId: string, userId: string, activeSince = "") {
      const { data, error } = await serviceClient
        .from("trip_share_participant_links")
        .select("participant_id")
        .eq("trip_share_id", tripShareId)
        .eq("user_id", userId)
        .gte("updated_at", activeSince)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async ensureParticipantLink({ tripShareId, participantId, userId }: { tripShareId: string; participantId: string; userId: string }) {
      const { error } = await serviceClient
        .from("trip_share_participant_links")
        .upsert({
          trip_share_id: tripShareId,
          participant_id: participantId,
          user_id: userId,
        }, { onConflict: "trip_share_id,user_id" });
      if (error) throw error;
    },
    async ensureReceivedRelation({ tripShareId, userId }: { tripShareId: string; userId: string }) {
      const { error } = await serviceClient
        .from("trip_share_recipients")
        .upsert({
          trip_share_id: tripShareId,
          recipient_user_id: userId,
          created_at: new Date().toISOString(),
          removed_at: null,
        }, { onConflict: "trip_share_id,recipient_user_id" });
      if (error) throw error;
    },
    async listParticipantLinks(tripShareId: string, activeSince = "") {
      const { data, error } = await serviceClient
        .from("trip_share_participant_links")
        .select("user_id")
        .eq("trip_share_id", tripShareId)
        .gte("updated_at", activeSince)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  };
}

function getRequesterItemProposalCard(proposal: Record<string, unknown>) {
  return {
    id: proposal.id,
    proposalType: "item",
    shareId: proposal.trip_share_id,
    tripId: proposal.trip_id,
    title: proposal.title,
    itemType: proposal.item_type,
    hasPrice: proposal.price !== null && proposal.price !== undefined && parseMoney(proposal.price) > 0,
    hasLink: Boolean(proposal.link),
    hasNote: Boolean(proposal.notes),
    status: proposal.status,
    acceptedItemId: proposal.accepted_item_id || "",
    createdAt: proposal.created_at,
    updatedAt: proposal.updated_at,
    resolvedAt: proposal.resolved_at || "",
  };
}

function getAuthorItemProposalCard(proposal: Record<string, unknown>, profileNames = new Map<string, string>()) {
  const requesterDisplayName = profileNames.get(String(proposal.requester_user_id || "")) || "Пользователь Backpacker";
  return {
    ...getRequesterItemProposalCard(proposal),
    requesterName: requesterDisplayName,
    requesterDisplayName,
    title: String(proposal.title || ""),
    itemType: String(proposal.item_type || "idea"),
    link: String(proposal.link || ""),
    price: proposal.price === null || proposal.price === undefined ? null : parseMoney(proposal.price),
    currency: String(proposal.currency || ""),
    notes: String(proposal.notes || ""),
  };
}

async function getRequestUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function getTripCard(share: Record<string, unknown>, revoked = false) {
  const state = (share.state || {}) as Record<string, unknown>;
  const trip = (state.trip || {}) as Record<string, unknown>;
  const startDate = String(trip.startDate || "");
  const endDate = String(trip.endDate || "");
  const start = startDate ? new Date(`${startDate}T12:00:00Z`) : null;
  const end = endDate ? new Date(`${endDate}T12:00:00Z`) : null;
  const dayCount = start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
    ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
    : 1;
  const includeBudget = share.include_budget !== false;
  return {
    shareId: share.id,
    title: String(trip.title || "Поездка"),
    destination: String(trip.destination || ""),
    startDate,
    endDate,
    dayCount: formatDayCountText(dayCount),
    ...getVisibleBudgetFields(trip, includeBudget),
    currency: String(trip.currency || "RUB"),
    coverDataUrl: String(trip.coverDataUrl || ""),
    includeBudget,
    isGroupTrip: trip.isGroupTrip === true,
    updatedAt: share.updated_at,
    revoked,
  };
}

function getAnalyticsRequestContext(body: Record<string, unknown>) {
  const input = body.analytics && typeof body.analytics === "object" && !Array.isArray(body.analytics)
    ? body.analytics as Record<string, unknown>
    : {};
  const eventId = String(input.event_id || "").trim().toLowerCase();
  return {
    eventId: /^[a-f0-9-]{36}$/.test(eventId) ? eventId : crypto.randomUUID(),
    appVersion: String(input.app_version || "").trim().slice(0, 80),
    environment: ["production", "local", "preview"].includes(String(input.environment || ""))
      ? String(input.environment)
      : "production",
    isInternalUser: input.is_internal_user === true,
    isTestUser: input.is_test_user === true,
  };
}

function scheduleSupabaseAnalyticsSignal({
  serviceClient,
  body,
  eventName,
  eventProperties,
  analyticsIdentity,
  identityType,
  idempotencyKey,
}: {
  serviceClient: UserClient;
  body: Record<string, unknown>;
  eventName: string;
  eventProperties: Record<string, unknown>;
  analyticsIdentity: string;
  identityType: "anonymous_browser" | "authenticated_account";
  idempotencyKey?: string;
}) {
  const context = getAnalyticsRequestContext(body);
  const sourceIdempotencyKey = idempotencyKey || `server:share_open:${analyticsIdentity}:${context.eventId}`;
  const releaseId = Deno.env.get("DENO_DEPLOYMENT_ID") || "trip-share.local";
  const occurredAt = new Date();
  const task = writeSupabaseSignal({
    client: serviceClient,
    sourceContract: analyticsSourceContract,
    eventName,
    eventProperties,
    analyticsIdentity,
    identityType,
    sourceProvenance: "live_supabase",
    idempotencyKey: sourceIdempotencyKey,
    appVersion: context.appVersion,
    releaseId,
    environment: context.environment,
    isInternalUser: context.isInternalUser,
    isTestUser: context.isTestUser,
    occurredAt,
  }).catch((error: { code?: string; message?: string }) => {
    console.error("trip_share_supabase_analytics_failed", {
      code: typeof error?.code === "string" ? error.code : (error?.message || "unexpected"),
      event: eventName,
    });
  });
  const edgeRuntime = (globalThis as AnalyticsContractGlobal).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
}

function formatDayCountText(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} дня`;
  return `${count} дней`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "read") {
    const token = String(body.token || "");
    if (!token) return json({ error: "token_required" }, 400);
    const tokenHash = await sha256Hex(token);
    const { data, error } = await serviceClient
      .from("trip_shares")
      .select("id, schema_version, trip_id, owner_user_id, include_budget, state, revoked_at, created_at, updated_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) return json({ error: "read_failed" }, 500);
    if (!data) return json({ error: "share_not_found" }, 404);
    if (data.revoked_at) return json({ error: "share_revoked" }, 410);
    const activeSince = getShareModeEpoch(data.state, data.created_at);
    const currentUser = await getRequestUser(req, supabaseUrl, anonKey);
    const isOwner = Boolean(currentUser && currentUser.id === data.owner_user_id);
    const profileNames = await getProfileDisplayNames(serviceClient, [
      String(data.owner_user_id || ""),
      ...(currentUser ? [currentUser.id] : []),
    ]);
    let isSaved = false;
    let isJoined = false;
    if (currentUser && !isOwner) {
      const { data: recipient } = await serviceClient
        .from("trip_share_recipients")
        .select("id")
        .eq("trip_share_id", data.id)
        .eq("recipient_user_id", currentUser.id)
        .gte("created_at", activeSince)
        .is("removed_at", null)
        .maybeSingle();
      isSaved = Boolean(recipient);
      if (isGroupTripState(data.state)) {
        const { data: participantLink } = await serviceClient
          .from("trip_share_participant_links")
          .select("id")
          .eq("trip_share_id", data.id)
          .eq("user_id", currentUser.id)
          .gte("updated_at", activeSince)
          .maybeSingle();
        isJoined = Boolean(participantLink);
      }
      scheduleSupabaseAnalyticsSignal({
        serviceClient,
        body,
        eventName: "shared_trip_opened",
        eventProperties: {
          trip_id: data.trip_id,
          trip_origin: "user_created",
          collaboration_id: data.id,
          actor_role: "recipient",
          access_mode: "view",
        },
        analyticsIdentity: currentUser.id,
        identityType: currentUser.is_anonymous === true ? "anonymous_browser" : "authenticated_account",
      });
    }
    return json({
      shareId: data.id,
      schemaVersion: data.schema_version,
      tripId: data.trip_id,
      includeBudget: data.include_budget,
      updatedAt: data.updated_at,
      programUpdatedAt: String(getTrip(data.state).programUpdatedAt || ""),
      isOwner,
      isAuthor: isOwner,
      isSaved,
      isGroupTrip: isGroupTripState(data.state),
      isJoined,
      authorDisplayName: profileNames.get(String(data.owner_user_id || "")) || "",
      currentUserDisplayName: currentUser ? (profileNames.get(currentUser.id) || "") : "",
      profileRequired: Boolean(currentUser && !profileNames.get(currentUser.id)),
      state: data.include_budget ? data.state : stripBudget(data.state),
    });
  }

  if (action === "open_group_material") {
    const token = String(body.token || "");
    const shareId = String(body.shareId || "");
    const materialId = String(body.materialId || "").trim().toLowerCase();
    if (!GROUP_MATERIAL_UUID_PATTERN.test(materialId)) return json({ error: "material_id_invalid" }, 400);
    if (!token && !shareId) return json({ error: "material_access_required" }, 400);

    const shareQuery = serviceClient
      .from("trip_shares")
      .select("id, trip_id, owner_user_id, state, revoked_at, created_at");
    const { data: share, error: shareError } = token
      ? await shareQuery.eq("token_hash", await sha256Hex(token)).maybeSingle()
      : await shareQuery.eq("id", shareId).maybeSingle();
    if (shareError) return json({ error: "material_open_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    if (!isGroupTripState(share.state)) return json({ error: "group_trip_required" }, 409);

    if (!token) {
      const currentUser = await getRequestUser(req, supabaseUrl, anonKey);
      if (!currentUser) return json({ error: "owner_jwt_required" }, 401);
      if (currentUser.id !== share.owner_user_id) {
        const activeSince = getShareModeEpoch(share.state, share.created_at);
        const { data: participantLink, error: participantError } = await serviceClient
          .from("trip_share_participant_links")
          .select("id")
          .eq("trip_share_id", share.id)
          .eq("user_id", currentUser.id)
          .gte("updated_at", activeSince)
          .maybeSingle();
        if (participantError) return json({ error: "material_open_failed" }, 500);
        if (!participantLink) return json({ error: "material_access_denied" }, 403);
      }
    }

    const materials = Array.isArray(getTrip(share.state).groupMaterials)
      ? getTrip(share.state).groupMaterials as Array<Record<string, unknown>>
      : [];
    if (!materials.some((entry) => String(entry.id || "").toLowerCase() === materialId)) {
      return json({ error: "material_not_shared" }, 404);
    }
    const { data: attachment, error: attachmentError } = await serviceClient
      .from("trip_item_attachments")
      .select("id, storage_path")
      .eq("id", materialId)
      .eq("owner_user_id", share.owner_user_id)
      .eq("trip_id", share.trip_id)
      .eq("trip_item_id", GROUP_MATERIAL_SCOPE_ID)
      .maybeSingle();
    if (attachmentError) return json({ error: "material_open_failed" }, 500);
    if (!attachment) return json({ error: "material_not_found" }, 404);
    const { data: signed, error: signedError } = await serviceClient.storage
      .from("trip-item-attachments")
      .createSignedUrl(String(attachment.storage_path || ""), 120);
    if (signedError || !signed?.signedUrl) return json({ error: "material_open_failed" }, 500);
    return json({ signedUrl: signed.signedUrl });
  }

  const user = await getRequestUser(req, supabaseUrl, anonKey);
  if (!user) return json({ error: "owner_jwt_required" }, 401);

  if (action === "join_group") {
    try {
      const result = await joinGroupTrip({
        shareId: String(body.shareId || ""),
        user,
        store: createGroupTripStore(serviceClient),
      });
      return json(result);
    } catch (error) {
      if (error instanceof GroupTripActionError) return json({ error: error.code }, error.status);
      return json({ error: "join_failed" }, 500);
    }
  }

  if (action === "get_group_context") {
    try {
      const result = await getOrganizerGroupContext({
        tripId: String(body.tripId || ""),
        user,
        store: createGroupTripStore(serviceClient),
      });
      return json(result);
    } catch (error) {
      if (error instanceof GroupTripActionError) return json({ error: error.code }, error.status);
      return json({ error: "group_context_failed" }, 500);
    }
  }

  if (action === "get_my_profile") {
    const displayName = await getProfileDisplayName(serviceClient, user.id);
    return json({
      ok: true,
      profile: displayName ? { displayName } : null,
    });
  }

  if (action === "upsert_my_profile") {
    const { displayName, error } = validateDisplayName(body.displayName);
    if (error) return json({ error }, 400);
    const { data, error: upsertError } = await serviceClient
      .from("user_profiles")
      .upsert({
        user_id: user.id,
        display_name: displayName,
      }, { onConflict: "user_id" })
      .select("display_name")
      .single();
    if (upsertError) return json({ error: "profile_save_failed" }, 500);
    return json({
      ok: true,
      profile: { displayName: String(data.display_name || displayName) },
    });
  }

  if (action === "get_share_context") {
    const shareId = String(body.shareId || "");
    if (!shareId) return json({ error: "share_id_required" }, 400);
    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, trip_id, owner_user_id, include_budget, state, revoked_at, created_at, updated_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "share_context_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    const activeSince = getShareModeEpoch(share.state, share.created_at);

    const { data: links } = await serviceClient
      .from("trip_share_participant_links")
      .select("participant_id, user_id")
      .eq("trip_share_id", shareId)
      .gte("updated_at", activeSince);
    const { data: proposals } = await serviceClient
      .from("trip_share_expense_proposals")
      .select("*")
      .eq("trip_share_id", shareId)
      .eq("requester_user_id", user.id)
      .order("created_at", { ascending: false });
    const profileNames = await getProfileDisplayNames(serviceClient, [
      user.id,
      String(share.owner_user_id || ""),
      ...(links || []).map((link) => String(link.user_id || "")),
    ]);
    const ownLink = (links || []).find((link) => link.user_id === user.id);
    const linkedParticipantIds = new Set((links || []).filter((link) => link.user_id !== user.id).map((link) => link.participant_id));
    const state = (share.state || {}) as Record<string, unknown>;
    const availableParticipants = getParticipants(state)
      .filter((participant) => !Boolean(participant.isSelf))
      .filter((participant) => !linkedParticipantIds.has(String(participant.id || "")))
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        initials: participant.initials,
        colorKey: participant.colorKey,
      }));
    return json({
      shareId,
      tripId: share.trip_id,
      includeBudget: share.include_budget,
      isOwner: share.owner_user_id === user.id,
      isAuthor: share.owner_user_id === user.id,
      authorDisplayName: profileNames.get(String(share.owner_user_id || "")) || "",
      currentUserDisplayName: profileNames.get(user.id) || "",
      profileRequired: !profileNames.get(user.id),
      userParticipantId: ownLink?.participant_id || "",
      availableParticipants,
      proposals: (proposals || []).map(getRequesterProposalCard),
    });
  }

  if (action === "create_expense_proposal") {
    const shareId = String(body.shareId || "");
    const itemId = String(body.itemId || "");
    const participantMode = String(body.participantMode || "");
    const requestedParticipantId = String(body.participantId || "");
    const proposedParticipantName = normalizeParticipantName(body.proposedParticipantName);
    const amount = parseMoney(body.amount);
    if (!shareId || !itemId) return json({ error: "proposal_target_required" }, 400);
    if (!["existing", "new"].includes(participantMode)) return json({ error: "participant_mode_invalid" }, 400);
    if (amount <= 0) return json({ error: "amount_invalid" }, 400);
    if (participantMode === "new" && !proposedParticipantName) return json({ error: "participant_name_required" }, 400);

    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, trip_id, owner_user_id, include_budget, state, revoked_at, created_at, updated_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "proposal_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    if (isGroupTripState(share.state)) return json({ error: "group_proposals_disabled" }, 409);
    if (share.owner_user_id === user.id) return json({ error: "owner_cannot_propose" }, 409);
    if (!share.include_budget) return json({ error: "budget_hidden" }, 403);
    const activeSince = getShareModeEpoch(share.state, share.created_at);

    const state = (share.state || {}) as Record<string, unknown>;
    const item = getItem(state, itemId);
    if (!item) return json({ error: "item_not_found" }, 404);
    const currency = String(getTrip(state).currency || "");
    const authorAmount = getAuthorAllocation(state, item);
    if (authorAmount <= 0) return json({ error: "author_allocation_empty" }, 409);
    if (amount > authorAmount) return json({ error: "amount_exceeds_author_allocation" }, 409);

    let participantId = "";
    const { data: existingUserLink } = await serviceClient
      .from("trip_share_participant_links")
      .select("participant_id")
      .eq("trip_share_id", shareId)
      .eq("user_id", user.id)
      .gte("updated_at", activeSince)
      .maybeSingle();
    if (participantMode === "existing") {
      participantId = requestedParticipantId;
      if (existingUserLink?.participant_id && existingUserLink.participant_id !== participantId) {
        return json({ error: "account_already_linked" }, 409);
      }
      const participant = getParticipant(state, participantId);
      if (!participant || Boolean(participant.isSelf)) return json({ error: "participant_not_available" }, 409);
      const linkedUserId = await getParticipantLinkUser(serviceClient, shareId, participantId, activeSince);
      if (linkedUserId && linkedUserId !== user.id) return json({ error: "participant_already_linked" }, 409);
    } else if (existingUserLink?.participant_id) {
      return json({ error: "account_already_linked" }, 409);
    }

    const financialVersion = await getFinancialVersion(serviceClient, shareId, state, itemId, participantId);
    const { data, error } = await serviceClient
      .from("trip_share_expense_proposals")
      .insert({
        trip_share_id: shareId,
        trip_id: share.trip_id,
        item_id: itemId,
        requester_user_id: user.id,
        participant_mode: participantMode,
        participant_id: participantMode === "existing" ? participantId : null,
        proposed_participant_name: participantMode === "new" ? proposedParticipantName : null,
        amount,
        currency,
        financial_version: financialVersion,
        status: "pending",
      })
      .select("*")
      .single();
    if (error?.code === "23505") return json({ error: "pending_proposal_exists" }, 409);
    if (error) return json({ error: "proposal_failed" }, 500);
    return json({ proposal: getRequesterProposalCard(data) });
  }

  if (action === "withdraw_expense_proposal") {
    const proposalId = String(body.proposalId || "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    const { data, error } = await serviceClient
      .from("trip_share_expense_proposals")
      .update({ status: "withdrawn", resolved_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("requester_user_id", user.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) return json({ error: "withdraw_failed" }, 500);
    if (!data) return json({ error: "proposal_not_found" }, 404);
    return json({ proposal: getRequesterProposalCard(data) });
  }

  if (action === "list_expense_proposals") {
    const tripId = String(body.tripId || "");
    if (!tripId) return json({ error: "trip_id_required" }, 400);
    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, trip_id, state")
      .eq("owner_user_id", user.id)
      .eq("trip_id", tripId)
      .maybeSingle();
    if (shareError) return json({ error: "list_proposals_failed" }, 500);
    if (!share) return json({ proposals: [], pendingCount: 0 });
    const { data: proposals, error } = await serviceClient
      .from("trip_share_expense_proposals")
      .select("*")
      .eq("trip_share_id", share.id)
      .order("created_at", { ascending: false });
    if (error) return json({ error: "list_proposals_failed" }, 500);
    const profileNames = await getProfileDisplayNames(serviceClient, (proposals || []).map((proposal) => String(proposal.requester_user_id || "")));
    const cards = (proposals || []).map((proposal) => getAuthorProposalCard(proposal, share, profileNames));
    return json({ proposals: cards, pendingCount: cards.filter((proposal) => proposal.status === "pending").length });
  }

  if (action === "reject_expense_proposal") {
    const proposalId = String(body.proposalId || "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    const { data: proposal, error: proposalError } = await serviceClient
      .from("trip_share_expense_proposals")
      .select("id, trip_share_id, status")
      .eq("id", proposalId)
      .maybeSingle();
    if (proposalError) return json({ error: "reject_failed" }, 500);
    if (!proposal) return json({ error: "proposal_not_found" }, 404);
    const { data: share } = await serviceClient
      .from("trip_shares")
      .select("id")
      .eq("id", proposal.trip_share_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (!share) return json({ error: "share_not_found" }, 404);
    if (proposal.status !== "pending") return json({ ok: true, status: proposal.status });
    const { error } = await serviceClient
      .from("trip_share_expense_proposals")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("status", "pending");
    if (error) return json({ error: "reject_failed" }, 500);
    return json({ ok: true, status: "rejected" });
  }

  if (action === "accept_expense_proposal") {
    const proposalId = String(body.proposalId || "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data, error } = await userClient.rpc("accept_expense_proposal", {
      p_proposal_id: proposalId,
    });
    if (error) return json({ error: "accept_failed" }, 500);
    const result = (data || {}) as Record<string, unknown>;
    if (result.error) return json({ error: result.error }, 404);
    return json(result);
  }

  if (action === "resolve_accepted_expense_proposal") {
    const proposalId = String(body.proposalId || "");
    const nextStatus = String(body.nextStatus || "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    if (!["rejected", "withdrawn"].includes(nextStatus)) return json({ error: "invalid_status" }, 400);
    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data, error } = await userClient.rpc("resolve_accepted_expense_proposal", {
      p_proposal_id: proposalId,
      p_next_status: nextStatus,
    });
    if (error) return json({ error: "resolve_failed" }, 500);
    const result = (data || {}) as Record<string, unknown>;
    if (result.error) return json({ error: result.error }, 409);
    return json(result);
  }

  if (action === "get_item_proposal_context") {
    const shareId = String(body.shareId || "");
    if (!shareId) return json({ error: "share_id_required" }, 400);
    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, trip_id, owner_user_id, revoked_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "item_proposal_context_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    const profileNames = await getProfileDisplayNames(serviceClient, [user.id, String(share.owner_user_id || "")]);
    const { data: proposals, error } = await serviceClient
      .from("trip_share_item_proposals")
      .select("id, trip_share_id, trip_id, title, item_type, link, price, currency, notes, status, accepted_item_id, created_at, updated_at, resolved_at")
      .eq("trip_share_id", shareId)
      .eq("requester_user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return json({ error: "item_proposal_context_failed" }, 500);
    return json({
      shareId,
      tripId: share.trip_id,
      isOwner: share.owner_user_id === user.id,
      isAuthor: share.owner_user_id === user.id,
      authorDisplayName: profileNames.get(String(share.owner_user_id || "")) || "",
      currentUserDisplayName: profileNames.get(user.id) || "",
      profileRequired: !profileNames.get(user.id),
      proposals: (proposals || []).map(getRequesterItemProposalCard),
    });
  }

  if (action === "create_item_proposal") {
    const shareId = String(body.shareId || "");
    const title = normalizeProposalText(body.title, 120);
    const itemType = ITEM_TYPES.has(String(body.itemType || "")) ? String(body.itemType) : "idea";
    const linkInput = String(body.link || "").trim();
    const link = linkInput ? normalizeProposalLink(linkInput) : "";
    const notes = normalizeProposalText(body.notes, 800);
    const idempotencyKey = normalizeProposalText(body.idempotencyKey, 80);
    const { amount: price, error: priceError } = parseOptionalMoney(body.price);
    if (!shareId) return json({ error: "share_id_required" }, 400);
    if (!title) return json({ error: "title_required" }, 400);
    if (linkInput && !link) return json({ error: "link_invalid" }, 400);
    if (priceError) return json({ error: priceError }, 400);

    const displayName = await getProfileDisplayName(serviceClient, user.id);
    if (!displayName) return json({ error: "profile_required" }, 409);

    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, trip_id, owner_user_id, state, revoked_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "item_proposal_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    if (share.owner_user_id === user.id) return json({ error: "owner_cannot_propose" }, 409);
    if (isGroupTripState(share.state)) return json({ error: "group_proposals_disabled" }, 409);
    const shareState = (share.state || {}) as Record<string, unknown>;
    const currency = String(getTrip(shareState).currency || "");

    const insertPayload = {
      trip_share_id: shareId,
      trip_id: share.trip_id,
      requester_user_id: user.id,
      title,
      item_type: itemType,
      link: link || null,
      price,
      currency,
      notes: notes || null,
      status: "pending",
      idempotency_key: idempotencyKey || null,
    };
    const { data, error } = await serviceClient
      .from("trip_share_item_proposals")
      .insert(insertPayload)
      .select("id, trip_share_id, trip_id, title, item_type, link, price, currency, notes, status, accepted_item_id, created_at, updated_at, resolved_at")
      .single();
    if (error?.code === "23505" && idempotencyKey) {
      const { data: existing } = await serviceClient
        .from("trip_share_item_proposals")
        .select("id, trip_share_id, trip_id, title, item_type, link, price, currency, notes, status, accepted_item_id, created_at, updated_at, resolved_at")
        .eq("requester_user_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) return json({ proposal: getRequesterItemProposalCard(existing), duplicate: true });
    }
    if (error) return json({ error: "item_proposal_failed" }, 500);
    return json({ proposal: getRequesterItemProposalCard(data) });
  }

  if (action === "withdraw_item_proposal") {
    const proposalId = String(body.proposalId || "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    const { data, error } = await serviceClient
      .from("trip_share_item_proposals")
      .update({ status: "withdrawn", resolved_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("requester_user_id", user.id)
      .eq("status", "pending")
      .select("id, trip_share_id, trip_id, title, item_type, link, price, currency, notes, status, accepted_item_id, created_at, updated_at, resolved_at")
      .maybeSingle();
    if (error) return json({ error: "withdraw_failed" }, 500);
    if (!data) return json({ error: "proposal_not_found" }, 404);
    return json({ proposal: getRequesterItemProposalCard(data) });
  }

  if (action === "list_item_proposals") {
    const tripId = String(body.tripId || "");
    if (!tripId) return json({ error: "trip_id_required" }, 400);
    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, trip_id")
      .eq("owner_user_id", user.id)
      .eq("trip_id", tripId)
      .maybeSingle();
    if (shareError) return json({ error: "list_item_proposals_failed" }, 500);
    if (!share) return json({ proposals: [], pendingCount: 0 });
    const { data: proposals, error } = await serviceClient
      .from("trip_share_item_proposals")
      .select("id, trip_share_id, trip_id, requester_user_id, title, item_type, link, price, currency, notes, status, accepted_item_id, created_at, updated_at, resolved_at")
      .eq("trip_share_id", share.id)
      .order("created_at", { ascending: false });
    if (error) return json({ error: "list_item_proposals_failed" }, 500);
    const profileNames = await getProfileDisplayNames(serviceClient, (proposals || []).map((proposal) => String(proposal.requester_user_id || "")));
    const cards = (proposals || []).map((proposal) => getAuthorItemProposalCard(proposal, profileNames));
    return json({ proposals: cards, pendingCount: cards.filter((proposal) => proposal.status === "pending").length });
  }

  if (action === "reject_item_proposal") {
    const proposalId = String(body.proposalId || "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    const { data: proposal, error: proposalError } = await serviceClient
      .from("trip_share_item_proposals")
      .select("id, trip_share_id, status")
      .eq("id", proposalId)
      .maybeSingle();
    if (proposalError) return json({ error: "reject_failed" }, 500);
    if (!proposal) return json({ error: "proposal_not_found" }, 404);
    const { data: share } = await serviceClient
      .from("trip_shares")
      .select("id")
      .eq("id", proposal.trip_share_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (!share) return json({ error: "share_not_found" }, 404);
    if (proposal.status !== "pending") return json({ ok: true, status: proposal.status });
    const { error } = await serviceClient
      .from("trip_share_item_proposals")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("status", "pending");
    if (error) return json({ error: "reject_failed" }, 500);
    return json({ ok: true, status: "rejected" });
  }

  if (action === "accept_item_proposal") {
    const proposalId = String(body.proposalId || "");
    if (!proposalId) return json({ error: "proposal_id_required" }, 400);
    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data, error } = await userClient.rpc("accept_item_proposal", {
      p_proposal_id: proposalId,
    });
    if (error) return json({ error: "accept_failed" }, 500);
    const result = (data || {}) as Record<string, unknown>;
    if (result.error) return json({ error: result.error }, 404);
    return json(result);
  }

  if (action === "save_received") {
    const shareId = String(body.shareId || "");
    if (!shareId) return json({ error: "share_id_required" }, 400);
    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, owner_user_id, state, revoked_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "save_received_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    if (isGroupTripState(share.state)) return json({ error: "group_join_required" }, 409);
    if (share.owner_user_id === user.id) return json({ error: "owner_cannot_save_own_share" }, 409);

    const { data, error } = await serviceClient
      .from("trip_share_recipients")
      .upsert({
        trip_share_id: shareId,
        recipient_user_id: user.id,
        created_at: new Date().toISOString(),
        removed_at: null,
      }, { onConflict: "trip_share_id,recipient_user_id" })
      .select("id, created_at")
      .single();
    if (error) return json({ error: "save_received_failed" }, 500);
    return json({ ok: true, recipientId: data.id, createdAt: data.created_at });
  }

  if (action === "list_received") {
    const { data: recipients, error } = await serviceClient
      .from("trip_share_recipients")
      .select("trip_share_id, created_at")
      .eq("recipient_user_id", user.id)
      .is("removed_at", null)
      .order("created_at", { ascending: false });
    if (error) return json({ error: "list_received_failed" }, 500);
    const shareIds = (recipients || []).map((entry) => entry.trip_share_id);
    if (!shareIds.length) return json({ trips: [] });
    const { data: shares, error: sharesError } = await serviceClient
      .from("trip_shares")
      .select("id, owner_user_id, include_budget, state, revoked_at, created_at, updated_at")
      .in("id", shareIds);
    if (sharesError) return json({ error: "list_received_failed" }, 500);
    const { data: participantLinks, error: participantLinksError } = await serviceClient
      .from("trip_share_participant_links")
      .select("trip_share_id, updated_at")
      .eq("user_id", user.id)
      .in("trip_share_id", shareIds);
    if (participantLinksError) return json({ error: "list_received_failed" }, 500);
    const sharesById = new Map((shares || []).map((share) => [share.id, share]));
    const joinedShareIds = new Set((participantLinks || [])
      .filter((entry) => {
        const share = sharesById.get(entry.trip_share_id);
        return share && Date.parse(entry.updated_at) >= Date.parse(getShareModeEpoch(share.state, share.created_at));
      })
      .map((entry) => entry.trip_share_id));
    const profileNames = await getProfileDisplayNames(serviceClient, (shares || []).map((share) => String(share.owner_user_id || "")));
    return json({
      trips: (recipients || [])
        .map((entry) => {
          const share = sharesById.get(entry.trip_share_id);
          if (!share || Date.parse(entry.created_at) < Date.parse(getShareModeEpoch(share.state, share.created_at))) return null;
          return {
            ...getTripCard(share, Boolean(share.revoked_at)),
            authorDisplayName: profileNames.get(String(share.owner_user_id || "")) || "",
            isJoined: joinedShareIds.has(entry.trip_share_id),
            savedAt: entry.created_at,
          };
        })
        .filter(Boolean),
    });
  }

  if (action === "read_received") {
    const shareId = String(body.shareId || "");
    if (!shareId) return json({ error: "share_id_required" }, 400);
    const { data: recipient, error: recipientError } = await serviceClient
      .from("trip_share_recipients")
      .select("id, created_at")
      .eq("trip_share_id", shareId)
      .eq("recipient_user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();
    if (recipientError) return json({ error: "read_received_failed" }, 500);
    if (!recipient) return json({ error: "received_share_not_found" }, 404);
    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, schema_version, trip_id, include_budget, state, revoked_at, created_at, updated_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "read_received_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    const activeSince = getShareModeEpoch(share.state, share.created_at);
    if (Date.parse(recipient.created_at) < Date.parse(activeSince)) {
      return json({ error: "received_share_not_found" }, 404);
    }
    const { data: participantLink, error: participantLinkError } = await serviceClient
      .from("trip_share_participant_links")
      .select("id")
      .eq("trip_share_id", shareId)
      .eq("user_id", user.id)
      .gte("updated_at", activeSince)
      .maybeSingle();
    if (participantLinkError) return json({ error: "read_received_failed" }, 500);
    scheduleSupabaseAnalyticsSignal({
      serviceClient,
      body,
      eventName: "shared_trip_opened",
      eventProperties: {
        trip_id: share.trip_id,
        trip_origin: "user_created",
        collaboration_id: share.id,
        actor_role: "recipient",
        access_mode: "view",
      },
      analyticsIdentity: user.id,
      identityType: user.is_anonymous === true ? "anonymous_browser" : "authenticated_account",
    });
    return json({
      shareId: share.id,
      schemaVersion: share.schema_version,
      tripId: share.trip_id,
      includeBudget: share.include_budget,
      updatedAt: share.updated_at,
      programUpdatedAt: String(getTrip(share.state).programUpdatedAt || ""),
      isGroupTrip: isGroupTripState(share.state),
      isJoined: Boolean(participantLink),
      state: share.include_budget ? share.state : stripBudget(share.state),
    });
  }

  if (action === "remove_received") {
    const shareId = String(body.shareId || "");
    if (!shareId) return json({ error: "share_id_required" }, 400);
    const { data, error } = await serviceClient
      .from("trip_share_recipients")
      .update({ removed_at: new Date().toISOString() })
      .eq("trip_share_id", shareId)
      .eq("recipient_user_id", user.id)
      .is("removed_at", null)
      .select("id")
      .maybeSingle();
    if (error) return json({ error: "remove_received_failed" }, 500);
    if (!data) return json({ error: "received_share_not_found" }, 404);
    return json({ ok: true });
  }

  const tripId = String(body.tripId || "");
  if (!tripId) return json({ error: "trip_id_required" }, 400);

  if (action === "publish") {
    const token = createToken();
    const tokenHash = await sha256Hex(token);
    const state = body.state;
    const schemaVersion = String(body.schemaVersion || SCHEMA_VERSION);
    let prepared;
    try {
      prepared = prepareTripShareWrite({ state, includeBudget: body.includeBudget !== false, user, stripBudget });
    } catch (error) {
      if (error instanceof GroupTripActionError) return json({ error: error.code }, error.status);
      return json({ error: "publish_failed" }, 500);
    }

    const { data, error } = await serviceClient
      .from("trip_shares")
      .upsert({
        owner_user_id: user.id,
        trip_id: tripId,
        token_hash: tokenHash,
        include_budget: prepared.includeBudget,
        schema_version: schemaVersion,
        state: prepared.state,
        revoked_at: null,
      }, { onConflict: "owner_user_id,trip_id" })
      .select("id, updated_at")
      .single();
    if (error) return json({ error: "publish_failed" }, 500);
    scheduleSupabaseAnalyticsSignal({
      serviceClient,
      body,
      eventName: "trip_share_created",
      eventProperties: {
        trip_id: tripId,
        trip_origin: "user_created",
        collaboration_id: data.id,
        actor_role: "owner",
        access_mode: "view",
        share_source: "link",
      },
      analyticsIdentity: user.id,
      identityType: user.is_anonymous === true ? "anonymous_browser" : "authenticated_account",
      idempotencyKey: `server:share_created:${data.id}`,
    });
    return json({ shareId: data.id, token, updatedAt: data.updated_at });
  }

  if (action === "update") {
    const state = body.state;
    const schemaVersion = String(body.schemaVersion || SCHEMA_VERSION);
    let prepared;
    try {
      const { data: previousShare, error: previousError } = await serviceClient
        .from("trip_shares")
        .select("state")
        .eq("owner_user_id", user.id)
        .eq("trip_id", tripId)
        .maybeSingle();
      if (previousError) return json({ error: "update_failed" }, 500);
      prepared = prepareTripShareWrite({
        state,
        includeBudget: body.includeBudget !== false,
        user,
        stripBudget,
        previousState: previousShare?.state || null,
      });
    } catch (error) {
      if (error instanceof GroupTripActionError) return json({ error: error.code }, error.status);
      return json({ error: "update_failed" }, 500);
    }
    const { data, error } = await serviceClient
      .from("trip_shares")
      .update({
        include_budget: prepared.includeBudget,
        schema_version: schemaVersion,
        state: prepared.state,
        revoked_at: null,
      })
      .eq("owner_user_id", user.id)
      .eq("trip_id", tripId)
      .select("id, updated_at")
      .maybeSingle();
    if (error) return json({ error: "update_failed" }, 500);
    if (!data) return json({ error: "share_not_found" }, 404);
    return json({ shareId: data.id, updatedAt: data.updated_at });
  }

  if (action === "revoke") {
    const { data, error } = await serviceClient
      .from("trip_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("owner_user_id", user.id)
      .eq("trip_id", tripId)
      .select("id")
      .maybeSingle();
    if (error) return json({ error: "revoke_failed" }, 500);
    if (!data) return json({ error: "share_not_found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
