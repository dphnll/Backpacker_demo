import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const SCHEMA_VERSION = "trip_share.v1";
const FINANCIAL_FIELDS = new Set(["price", "paidAmount", "budgetLimit", "allocations"]);
const PARTICIPANT_COLORS = ["orange", "yellow", "blue", "teal", "purple", "pink"];
const ITEM_TYPES = new Set(["ticket", "stay", "transport", "excursion", "food", "place", "spa", "shopping", "idea", "other"]);

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

async function getProfileDisplayName(serviceClient: ReturnType<typeof createClient>, userId: string) {
  if (!userId) return "";
  const { data } = await serviceClient
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return String(data?.display_name || "");
}

async function getProfileDisplayNames(serviceClient: ReturnType<typeof createClient>, userIds: string[]) {
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

async function getParticipantLinkUser(serviceClient: ReturnType<typeof createClient>, shareId: string, participantId: string) {
  if (!participantId) return "";
  const { data } = await serviceClient
    .from("trip_share_participant_links")
    .select("user_id")
    .eq("trip_share_id", shareId)
    .eq("participant_id", participantId)
    .maybeSingle();
  return data?.user_id || "";
}

async function getFinancialVersion(
  serviceClient: ReturnType<typeof createClient>,
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

function stripBudget(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripBudget);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !FINANCIAL_FIELDS.has(key))
      .map(([key, entry]) => [key, stripBudget(entry)]),
  );
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
  return {
    shareId: share.id,
    title: String(trip.title || "Поездка"),
    destination: String(trip.destination || ""),
    startDate,
    endDate,
    dayCount: `${dayCount} ${dayCount === 1 ? "день" : "дн."}`,
    budgetLimit: parseMoney(trip.budgetLimit),
    currency: String(trip.currency || "RUB"),
    coverDataUrl: String(trip.coverDataUrl || ""),
    includeBudget: share.include_budget !== false,
    updatedAt: share.updated_at,
    revoked,
  };
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
      .select("id, schema_version, trip_id, owner_user_id, include_budget, state, revoked_at, updated_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) return json({ error: "read_failed" }, 500);
    if (!data) return json({ error: "share_not_found" }, 404);
    if (data.revoked_at) return json({ error: "share_revoked" }, 410);
    const currentUser = await getRequestUser(req, supabaseUrl, anonKey);
    const isOwner = Boolean(currentUser && currentUser.id === data.owner_user_id);
    const profileNames = await getProfileDisplayNames(serviceClient, [
      String(data.owner_user_id || ""),
      ...(currentUser ? [currentUser.id] : []),
    ]);
    let isSaved = false;
    if (currentUser && !isOwner) {
      const { data: recipient } = await serviceClient
        .from("trip_share_recipients")
        .select("id")
        .eq("trip_share_id", data.id)
        .eq("recipient_user_id", currentUser.id)
        .is("removed_at", null)
        .maybeSingle();
      isSaved = Boolean(recipient);
    }
    return json({
      shareId: data.id,
      schemaVersion: data.schema_version,
      tripId: data.trip_id,
      includeBudget: data.include_budget,
      updatedAt: data.updated_at,
      isOwner,
      isAuthor: isOwner,
      isSaved,
      authorDisplayName: profileNames.get(String(data.owner_user_id || "")) || "",
      currentUserDisplayName: currentUser ? (profileNames.get(currentUser.id) || "") : "",
      profileRequired: Boolean(currentUser && !profileNames.get(currentUser.id)),
      state: data.include_budget ? data.state : stripBudget(data.state),
    });
  }

  const user = await getRequestUser(req, supabaseUrl, anonKey);
  if (!user) return json({ error: "owner_jwt_required" }, 401);

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
      .select("id, trip_id, owner_user_id, include_budget, state, revoked_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "share_context_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);

    const { data: links } = await serviceClient
      .from("trip_share_participant_links")
      .select("participant_id, user_id")
      .eq("trip_share_id", shareId);
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
      .select("id, trip_id, owner_user_id, include_budget, state, revoked_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "proposal_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    if (share.owner_user_id === user.id) return json({ error: "owner_cannot_propose" }, 409);
    if (!share.include_budget) return json({ error: "budget_hidden" }, 403);

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
      .maybeSingle();
    if (participantMode === "existing") {
      participantId = requestedParticipantId;
      if (existingUserLink?.participant_id && existingUserLink.participant_id !== participantId) {
        return json({ error: "account_already_linked" }, 409);
      }
      const participant = getParticipant(state, participantId);
      if (!participant || Boolean(participant.isSelf)) return json({ error: "participant_not_available" }, 409);
      const linkedUserId = await getParticipantLinkUser(serviceClient, shareId, participantId);
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
      .select("id, owner_user_id, revoked_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "save_received_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    if (share.owner_user_id === user.id) return json({ error: "owner_cannot_save_own_share" }, 409);

    const { data, error } = await serviceClient
      .from("trip_share_recipients")
      .upsert({
        trip_share_id: shareId,
        recipient_user_id: user.id,
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
      .select("id, owner_user_id, include_budget, state, revoked_at, updated_at")
      .in("id", shareIds);
    if (sharesError) return json({ error: "list_received_failed" }, 500);
    const sharesById = new Map((shares || []).map((share) => [share.id, share]));
    const profileNames = await getProfileDisplayNames(serviceClient, (shares || []).map((share) => String(share.owner_user_id || "")));
    return json({
      trips: (recipients || [])
        .map((entry) => {
          const share = sharesById.get(entry.trip_share_id);
          if (!share) return null;
          return {
            ...getTripCard(share, Boolean(share.revoked_at)),
            authorDisplayName: profileNames.get(String(share.owner_user_id || "")) || "",
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
      .select("id")
      .eq("trip_share_id", shareId)
      .eq("recipient_user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();
    if (recipientError) return json({ error: "read_received_failed" }, 500);
    if (!recipient) return json({ error: "received_share_not_found" }, 404);
    const { data: share, error: shareError } = await serviceClient
      .from("trip_shares")
      .select("id, schema_version, trip_id, include_budget, state, revoked_at, updated_at")
      .eq("id", shareId)
      .maybeSingle();
    if (shareError) return json({ error: "read_received_failed" }, 500);
    if (!share) return json({ error: "share_not_found" }, 404);
    if (share.revoked_at) return json({ error: "share_revoked" }, 410);
    return json({
      shareId: share.id,
      schemaVersion: share.schema_version,
      tripId: share.trip_id,
      includeBudget: share.include_budget,
      updatedAt: share.updated_at,
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
    const includeBudget = body.includeBudget !== false;
    const schemaVersion = String(body.schemaVersion || SCHEMA_VERSION);
    if (!state || typeof state !== "object") return json({ error: "state_required" }, 400);

    const { data, error } = await serviceClient
      .from("trip_shares")
      .upsert({
        owner_user_id: user.id,
        trip_id: tripId,
        token_hash: tokenHash,
        include_budget: includeBudget,
        schema_version: schemaVersion,
        state,
        revoked_at: null,
      }, { onConflict: "owner_user_id,trip_id" })
      .select("id, updated_at")
      .single();
    if (error) return json({ error: "publish_failed" }, 500);
    return json({ shareId: data.id, token, updatedAt: data.updated_at });
  }

  if (action === "update") {
    const state = body.state;
    const includeBudget = body.includeBudget !== false;
    const schemaVersion = String(body.schemaVersion || SCHEMA_VERSION);
    if (!state || typeof state !== "object") return json({ error: "state_required" }, 400);
    const { data, error } = await serviceClient
      .from("trip_shares")
      .update({
        include_budget: includeBudget,
        schema_version: schemaVersion,
        state,
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
