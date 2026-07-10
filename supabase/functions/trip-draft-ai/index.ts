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
      required: ["title", "destination", "startDate", "endDate", "dayCount", "datePrecision", "dateSourceText", "currency", "budgetLimit", "preferencesText"],
      properties: {
        title: { type: "string" },
        destination: { type: "string" },
        startDate: { type: "string", description: "YYYY-MM-DD or empty string" },
        endDate: { type: "string", description: "YYYY-MM-DD or empty string" },
        dayCount: { type: "number", description: "Trip duration in days. If the user gives a range like 3-4 days, use the maximum value. Use 1 when unknown." },
        datePrecision: { type: "string", enum: ["exact", "approximate", "none"], description: "exact for dates explicitly provided by the user, approximate for inferred dates from natural-language periods, none when dates are empty." },
        dateSourceText: { type: ["string", "null"], description: "Original user phrase that caused approximate date inference, otherwise null." },
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
        required: ["title", "type", "status", "priority", "date", "dayIndex", "startTime", "durationMinutes", "price", "link", "locationText", "notes"],
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["stay", "transport", "excursion", "food", "place", "spa", "shopping", "idea", "other"] },
          status: { type: "string", enum: ["paid", "fixed", "want", "maybe", "backup", "skipped"] },
          priority: { type: "string", enum: ["must", "nice", "optional"] },
          date: { type: "string", description: "YYYY-MM-DD when explicitly known, otherwise empty string" },
          dayIndex: { type: "number", description: "1-based day number when user mentions Day 1/2/etc or sequence is clear and exact dates are unknown. Use 0 when unknown." },
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

const tripDraftSystemPrompt = [
  "You convert a free-form travel plan into a Backpacker trip draft.",
  "Return only structured JSON matching the provided schema.",
  "Preserve the user's language for all human-facing fields: trip title, destination, item titles, locations, notes, preferencesText, and questions.",
  "Extract explicitly mentioned destination, date range, duration, activities, constraints, transport preferences, people count, budget, and must-not-do preferences.",
  "Always set trip.dayCount. If exact dates are unknown but the user states duration, use that duration. If the user gives a duration range like 3-4 days, use the maximum value.",
  "Use RUB as default currency unless the user explicitly names another currency.",
  "If the user gives a relative or partial exact date without a year, infer the nearest future year from today's date.",
  "If the user gives an approximate period, you may suggest a concrete date range inside that period and set trip.datePrecision to approximate. Put the original phrase in trip.dateSourceText.",
  "Approximate period rules: first half of month means choose a range in the first half; middle of month means around the middle; second half means start after the 15th; end of month means the last 7-10 days. Use the stated duration. If the year is missing, choose the nearest future matching month; if that month has passed this year, use next year. If ambiguous, leave dates empty and set datePrecision none.",
  "If dates are explicitly named by the user, set datePrecision exact and dateSourceText null. If dates are empty, set datePrecision none and dateSourceText null.",
  "If an item has an explicit date or can be placed inside the extracted date range, set date as YYYY-MM-DD. If exact dates are unknown but the item belongs to Day 1, Day 2, etc., leave date empty and set dayIndex. If the day is truly unknown, leave date empty and dayIndex 0 so the app can put it into parking.",
  "If time is not explicitly known, leave startTime empty. Do not invent exact times.",
  "Create one item for each concrete activity, place, meal idea, transport, stay, spa, shopping item, or open idea mentioned by the user.",
  "Do not replace specific user ideas with generic tasks like 'choose accommodation' unless the user only asked for planning help and did not name concrete ideas.",
  "Default status for ideas is want. Default priority is nice.",
  "Use type spa for hammam/spa/bathhouse, excursion for tours/cruises/museums, food for meals/restaurants, place for attractions/walks/viewpoints, stay for accommodation, transport for movement.",
  "Do not create a ticket type. Tickets for transport are transport; tickets for museums or attractions are excursion or place; tickets for concerts or shows use the best existing non-ticket type.",
  "Use transport only when the main purpose is moving the traveler from one point to another: flight, train, bus, transfer, taxi, car rental, own car, metro, tram, ferry, boat used as transport, or similar movement. Keep the concrete mode in the item title, e.g. 'Перелёт Москва — Стамбул' or 'Паром до острова'.",
  "Do not use transport when the main purpose is an experience, tour, meal, or entertainment even if a vehicle is involved. Boat tour, sightseeing bus tour, dinner cruise, canal excursion, or retro tram ride for fun should be excursion, food, activity-like idea, or another existing type by main purpose.",
  "Format preferencesText as 4-6 short editable bullet lines at most, using categories only when present: '• Обязательно: ...', '• Темп: ...', '• Опционально: ...', '• Ограничения: ...'. Do not repeat the whole source text or duplicate concrete events unless they express a general preference.",
  "Health, allergies, mobility, food restrictions, pace, and dislikes are planning constraints only. Record them in preferencesText or item notes.",
  "Do not provide medical advice, diagnoses, treatment guidance, or health risk assessment.",
  "Ask up to five short clarifying questions only for important missing planning data.",
].join("\n");

async function parseDraft(body: Record<string, unknown>, openAiKey: string) {
  const text = safeString(body.text, 30000);
  if (text.length < 20) return json({ error: "text_too_short" }, 400);

  const prompt = [
    "Ты помогаешь превратить свободное описание поездки в черновик Backpacker.",
    "Верни только структурированный JSON по схеме.",
    "Всегда заполняй trip.dayCount. Если точных календарных дат нет, но пользователь сказал количество дней, используй его. Если сказал диапазон вроде 3-4 дня, бери максимум: 4.",
    "Если пользователь указал приблизительный период вроде 'во второй половине августа', можешь предложить конкретный диапазон внутри периода, указать trip.datePrecision='approximate' и сохранить исходную формулировку в trip.dateSourceText. Первая половина месяца — диапазон в первой половине, середина — около середины, вторая половина — старт после 15 числа, конец месяца — последние 7-10 дней. Если год не указан, бери ближайший будущий подходящий месяц; если месяц уже прошёл в текущем году, бери следующий год. Если неоднозначно — оставь даты пустыми, datePrecision='none', dateSourceText=null.",
    "Если пользователь назвал точные даты, ставь trip.datePrecision='exact' и trip.dateSourceText=null. Если дат нет — datePrecision='none' и dateSourceText=null.",
    "Если точная дата события неизвестна, но понятно, что это День 1, День 2 и т.п., оставь date пустым и заполни dayIndex номером дня.",
    "Если дата, день или время явно не указаны, оставляй date/startTime пустыми, а dayIndex 0: такие элементы попадут в парковку.",
    "Не выдумывай медицинские советы. Аллергии, здоровье, мобильность, питание, темп и запреты фиксируй только как ограничения планирования в preferencesText или notes.",
    "Не создавай диагнозы, риски лечения или рекомендации по лечению.",
    "Не создавай тип ticket или 'Билет'. Билеты на транспорт — transport; билеты в музей/достопримечательность — excursion или place; билеты на концерт/событие — лучший существующий тип по смыслу.",
    "Тип transport используй только когда главная задача события — перемещение из точки в точку: перелёт, поезд, автобус, трансфер, такси, аренда авто, своё авто, метро, трамвай, паром/катер/теплоход как способ добраться. Конкретный способ оставляй в названии карточки.",
    "Если транспорт используется ради впечатления или экскурсии — прогулка на теплоходе, обзорная автобусная экскурсия, круиз с ужином, лодка по каналам — не ставь transport; выбирай excursion, food, idea или другой существующий тип по главной цели.",
    "preferencesText оформи короткими редактируемыми строками с буллитами, максимум 4-6 строк: '• Обязательно: ...', '• Темп: ...', '• Опционально: ...', '• Ограничения: ...'. Не повторяй исходное описание целиком, не дублируй события, объединяй близкие идеи и пропускай пустые категории.",
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
        { role: "system", content: `${tripDraftSystemPrompt}\n\n${prompt}` },
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
