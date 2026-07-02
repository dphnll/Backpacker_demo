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

async function requireOwner(req: Request, supabaseUrl: string, anonKey: string) {
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
      .select("id, schema_version, trip_id, include_budget, state, revoked_at, updated_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) return json({ error: "read_failed" }, 500);
    if (!data) return json({ error: "share_not_found" }, 404);
    if (data.revoked_at) return json({ error: "share_revoked" }, 410);
    return json({
      shareId: data.id,
      schemaVersion: data.schema_version,
      tripId: data.trip_id,
      includeBudget: data.include_budget,
      updatedAt: data.updated_at,
      state: data.include_budget ? data.state : stripBudget(data.state),
    });
  }

  const user = await requireOwner(req, supabaseUrl, anonKey);
  if (!user) return json({ error: "owner_jwt_required" }, 401);

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
