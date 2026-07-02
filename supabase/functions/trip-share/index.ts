import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const SCHEMA_VERSION = "trip_share.v1";
const FINANCIAL_FIELDS = new Set(["price", "paidAmount", "budgetLimit", "allocations"]);

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
  return {
    shareId: share.id,
    title: String(trip.title || "Поездка"),
    destination: String(trip.destination || ""),
    startDate: String(trip.startDate || ""),
    endDate: String(trip.endDate || ""),
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
      isSaved,
      state: data.include_budget ? data.state : stripBudget(data.state),
    });
  }

  const user = await getRequestUser(req, supabaseUrl, anonKey);
  if (!user) return json({ error: "owner_jwt_required" }, 401);

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
      .select("id, state, revoked_at, updated_at")
      .in("id", shareIds);
    if (sharesError) return json({ error: "list_received_failed" }, 500);
    const sharesById = new Map((shares || []).map((share) => [share.id, share]));
    return json({
      trips: (recipients || [])
        .map((entry) => {
          const share = sharesById.get(entry.trip_share_id);
          if (!share) return null;
          return { ...getTripCard(share, Boolean(share.revoked_at)), savedAt: entry.created_at };
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
