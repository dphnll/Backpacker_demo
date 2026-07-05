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
  const match = text.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1] || "audio/webm";
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
  const extension = parsed.mimeType.includes("mp4") ? "mp4" : parsed.mimeType.includes("mpeg") ? "mp3" : "webm";
  form.append("model", Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe");
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

const tripDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["trip", "items", "questions"],
  properties: {
    trip: {
      type: "object",
      additionalProperties: false,
      required: ["title", "destination", "startDate", "endDate", "currency", "budgetLimit", "preferencesText"],
      properties: {
        title: { type: "string" },
        destination: { type: "string" },
        startDate: { type: "string", description: "YYYY-MM-DD or empty string" },
        endDate: { type: "string", description: "YYYY-MM-DD or empty string" },
        currency: { type: "string", enum: ["RUB", "EUR", "SEK", "USD", "GEL", "TRY", "RSD", "BAM"] },
        budgetLimit: { type: "number" },
        preferencesText: { type: "string" },
      },
    },
    items: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "type", "status", "priority", "date", "startTime", "durationMinutes", "price", "link", "locationText", "notes"],
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["ticket", "stay", "transport", "excursion", "food", "place", "spa", "shopping", "idea", "other"] },
          status: { type: "string", enum: ["paid", "fixed", "want", "maybe", "backup", "skipped"] },
          priority: { type: "string", enum: ["must", "nice", "optional"] },
          date: { type: "string", description: "YYYY-MM-DD when explicitly known, otherwise empty string" },
          startTime: { type: "string", description: "HH:MM when explicitly known, otherwise empty string" },
          durationMinutes: { type: "number" },
          price: { type: "number" },
          link: { type: "string" },
          locationText: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    questions: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
  },
} as const;

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
  if (text.length < 20) return json({ error: "text_too_short" }, 400);

  const prompt = [
    "Ты помогаешь превратить свободное описание поездки в черновик Backpacker.",
    "Верни только структурированный JSON по схеме.",
    "Если дата или время явно не указаны, оставляй date/startTime пустыми: такие элементы попадут в парковку.",
    "Не выдумывай медицинские советы. Аллергии, здоровье, мобильность, питание, темп и запреты фиксируй только как ограничения планирования в preferencesText или notes.",
    "Не создавай диагнозы, риски лечения или рекомендации по лечению.",
    "Статус по умолчанию для идей: want. Приоритет по умолчанию: nice.",
  ].join("\n");

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
          schema: tripDraftSchema,
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: "parse_failed" }, response.status);
  const outputText = extractOutputText(data as Record<string, unknown>);
  try {
    return json({ draft: JSON.parse(outputText) });
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
    return json({ error: "unknown_action" }, 400);
  } catch {
    return json({ error: "trip_draft_ai_failed" }, 500);
  }
});
