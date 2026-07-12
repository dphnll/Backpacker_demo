// @ts-ignore Deno can import shared ESM modules without a local TS declaration file.
import { ControlledFetchError, createFirecrawlControlledFetch } from "../_shared/link-intake/controlled-fetch.mjs";
// @ts-ignore Deno can import shared ESM modules without a local TS declaration file.
import { extractTravelCandidate } from "../_shared/link-intake/travel-candidate.mjs";
// @ts-ignore Deno can import shared ESM modules without a local TS declaration file.
import { buildBaseDraftFromCandidate } from "../_shared/link-intake/item-draft-normalizer.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeUrl(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text.length > 2000) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !authHeader.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authHeader,
    },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return typeof user?.id === "string" ? user : null;
}

function mapProviderError(error: unknown) {
  if (error instanceof ControlledFetchError) {
    if (error.code === "PROVIDER_NOT_CONFIGURED") return { error: "provider_not_configured", status: 500 };
    if (error.code === "PROVIDER_AUTH_FAILED") return { error: "provider_auth_failed", status: 502 };
    if (error.code === "FETCH_TIMEOUT") return { error: "fetch_timeout", status: 504 };
    if (error.code === "CONTENT_TOO_LARGE") return { error: "content_too_large", status: 413 };
    if (error.code === "PROVIDER_RATE_LIMITED") return { error: "provider_rate_limited", status: 429 };
    return { error: "provider_failed", status: 502 };
  }
  return { error: "link_intake_failed", status: 500 };
}

async function previewItemDraft(body: Record<string, unknown>) {
  const url = normalizeUrl(body.url);
  if (!url) return json({ error: "invalid_url" }, 400);

  const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY") || "";
  if (!firecrawlApiKey) return json({ error: "provider_not_configured" }, 500);

  try {
    const controlledFetch = createFirecrawlControlledFetch({ apiKey: firecrawlApiKey });
    const page = await controlledFetch(url);
    const candidate = extractTravelCandidate(page, { sourceType: "link_intake" });
    const draft = buildBaseDraftFromCandidate(candidate);
    const hasUsefulDraft = Boolean(draft.title || draft.sourceUrl || draft.description || draft.locationText);
    if (!hasUsefulDraft) return json({ error: "empty_draft" }, 422);
    return json({
      draft,
      warnings: Array.isArray(draft.warnings) ? draft.warnings : [],
    });
  } catch (error) {
    const mapped = mapProviderError(error);
    return json({ error: mapped.error }, mapped.status);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (body.action === "preview") return await previewItemDraft(body);
  return json({ error: "unknown_action" }, 400);
});
