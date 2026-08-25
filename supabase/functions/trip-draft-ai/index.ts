// @ts-ignore Deno bundles the repository-root side-effect import.
import "../../../trip-draft-ai-core.js";

// The schema and the prompt rules live in one shared module so the Node contract tests
// exercise exactly what is sent to the model.
// @ts-ignore The shared module registers itself on globalThis for both runtimes.
const draftCore = (globalThis as Record<string, any>).BackpackerTripDraftAiCore;

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

function safeString(value: unknown, limit = 8000) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, limit);
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

function parseAudioDataUrl(value: unknown) {
  const text = String(value || "");
  const match = text.match(/^data:([^,]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = (match[1] || "audio/webm").split(";")[0] || "audio/webm";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { mimeType, bytes };
}

async function transcribe(body: Record<string, unknown>, openAiKey: string) {
  const parsed = parseAudioDataUrl(body.audioDataUrl);
  if (!parsed || parsed.bytes.byteLength < 1000) return json({ error: "invalid_audio" }, 400);
  if (parsed.bytes.byteLength > 18 * 1024 * 1024) return json({ error: "audio_too_large" }, 413);

  const form = new FormData();
  const extension = parsed.mimeType.includes("mp4")
    ? "mp4"
    : parsed.mimeType.includes("mpeg") || parsed.mimeType.includes("mp3")
      ? "mp3"
      : parsed.mimeType.includes("m4a")
        ? "m4a"
        : parsed.mimeType.includes("wav")
          ? "wav"
          : parsed.mimeType.includes("ogg")
            ? "ogg"
            : "webm";
  form.append("model", Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe");
  form.append("language", draftCore.normalizeAiDraftLocale(body.locale));
  form.append("file", new Blob([parsed.bytes], { type: parsed.mimeType }), `trip-voice.${extension}`);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: "transcription_failed" }, response.status);
  return json({ text: safeString(data.text, 20000) });
}


function extractOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  return output
    .flatMap((entry) => Array.isArray((entry as Record<string, unknown>).content) ? (entry as Record<string, unknown>).content as Record<string, unknown>[] : [])
    .map((content) => typeof content.text === "string" ? content.text : "")
    .filter(Boolean)
    .join("\n");
}


async function parseDraft(body: Record<string, unknown>, openAiKey: string) {
  const text = safeString(body.text, 30000);
  const locale = draftCore.normalizeAiDraftLocale(body.locale);
  if (text.length < 20) return json({ error: "text_too_short" }, 400);

  try {
    draftCore.assertSupportedSchemaVersion(body.schemaVersion);
  } catch (error) {
    // A client built against another contract must fail loudly rather than silently
    // receive fields it cannot read.
    return json({ error: (error as { code?: string }).code || "trip_draft_schema_version_unsupported" }, 400);
  }

  // Date grounding: the model must never guess what day it is today.
  const today = safeString(body.today, 10);
  const timezone = safeString(body.timezone, 80);
  const prompt = draftCore.buildTripDraftPrompt({ today, timezone, locale });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TRIP_DRAFT_MODEL") || "gpt-5.5",
      reasoning: { effort: Deno.env.get("OPENAI_TRIP_DRAFT_REASONING") || "low" },
      input: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "backpacker_trip_draft",
          strict: true,
          schema: draftCore.tripDraftSchema,
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: "parse_failed" }, response.status);
  const outputText = extractOutputText(data as Record<string, unknown>);
  try {
    // Guardrails are applied server-side too, so a hallucinated link or price never
    // leaves the function even if the model ignored the rules.
    const draft = draftCore.applyDraftGuardrails(JSON.parse(outputText), text);
    return json({ draft, schemaVersion: draftCore.TRIP_DRAFT_AI_SCHEMA_VERSION });
  } catch {
    return json({ error: "invalid_model_output" }, 502);
  }
}


// Booking Pack: the traveller's own documents go straight to the model. The provider accepts
// PDF as input_file and images as input_image, both as base64 data URLs, so no OCR step,
// no extraction service and no upload to a Files API is involved.
async function parseDocuments(body: Record<string, unknown>, openAiKey: string) {
  const locale = draftCore.normalizeAiDraftLocale(body.locale);
  try {
    draftCore.assertSupportedSchemaVersion(body.schemaVersion, draftCore.BOOKING_PACK_SCHEMA_VERSION);
  } catch (error) {
    return json({ error: (error as { code?: string }).code || "trip_draft_schema_version_unsupported" }, 400);
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) return json({ error: "no_documents" }, 400);
  if (files.length > draftCore.BOOKING_PACK_MAX_FILES) return json({ error: "too_many_documents" }, 400);

  const parts: Record<string, unknown>[] = [];
  let totalBytes = 0;
  for (const entry of files) {
    const file = entry as Record<string, unknown>;
    const dataUrl = String(file.dataUrl || "");
    const mimeType = String(file.mimeType || "").toLowerCase();
    const fileName = safeString(file.fileName, 200) || "document";
    const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) return json({ error: "invalid_document" }, 400);
    totalBytes += Math.floor((match[2].length * 3) / 4);
    if (totalBytes > draftCore.BOOKING_PACK_MAX_TOTAL_BYTES) return json({ error: "documents_too_large" }, 413);
    if (mimeType === "application/pdf") {
      parts.push({ type: "input_file", filename: fileName, file_data: dataUrl });
    } else if (["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      parts.push({ type: "input_image", image_url: dataUrl });
    } else {
      return json({ error: "unsupported_document_type" }, 400);
    }
  }

  const comment = safeString(body.comment, 2000);
  parts.push({
    type: "input_text",
    text: locale === "en"
      ? (comment
        ? `Read the attached trip documents. Traveller comment: ${comment}`
        : "Read the attached trip documents.")
      : (comment
        ? `Разбери приложенные документы поездки. Комментарий путешественника: ${comment}`
        : "Разбери приложенные документы поездки."),
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TRIP_DRAFT_MODEL") || "gpt-5.5",
      reasoning: { effort: Deno.env.get("OPENAI_BOOKING_PACK_REASONING") || "medium" },
      input: [
        { role: "system", content: draftCore.buildBookingPackPrompt({ today: safeString(body.today, 10), timezone: safeString(body.timezone, 80), locale }) },
        { role: "user", content: parts },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "backpacker_booking_pack",
          strict: true,
          schema: draftCore.bookingPackSchema,
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: "parse_failed" }, response.status);
  const outputText = extractOutputText(data as Record<string, unknown>);
  try {
    // Evidence rules run server-side too, so an unproven price never leaves the function.
    const fileIds = files.map((entry) => String((entry as Record<string, unknown>).sourceFileId || ""));
    const draft = draftCore.applyBookingPackEvidenceRules(JSON.parse(outputText), { fileIds, locale });
    return json({ draft, schemaVersion: draftCore.BOOKING_PACK_SCHEMA_VERSION });
  } catch {
    return json({ error: "invalid_model_output" }, 502);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!openAiKey) return json({ error: "openai_not_configured" }, 500);
  const user = await requireUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  try {
    if (body.action === "transcribe") return await transcribe(body, openAiKey);
    if (body.action === "parse") return await parseDraft(body, openAiKey);
    if (body.action === "parse_documents") return await parseDocuments(body, openAiKey);
    return json({ error: "unknown_action" }, 400);
  } catch {
    return json({ error: "trip_draft_ai_failed" }, 500);
  }
});
