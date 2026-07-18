(function initTravelIdeasClient(root) {
  "use strict";

  const COLLECTIONS_TABLE = "travel_idea_collections";
  const IDEAS_TABLE = "travel_ideas";

  function createClientError(error, fallback = "travel_ideas_request_failed") {
    if (!error) return null;
    const wrapped = new Error(error.message || fallback);
    wrapped.code = error.code || error.error_code || "";
    wrapped.status = error.status || error.statusCode || 0;
    wrapped.details = error.details || "";
    wrapped.hint = error.hint || "";
    return wrapped;
  }

  function assertSupabaseClient(client) {
    if (!client?.from) throw new Error("supabase_not_configured");
  }

  async function unwrapSupabaseResult(query, fallback) {
    const result = await query;
    if (result?.error) throw createClientError(result.error, fallback);
    return result?.data;
  }

  function getTravelIdeasClientErrorMessage(error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "").toLowerCase();
    const status = Number(error?.status || 0);
    if (error?.message === "supabase_not_configured") {
      return "Supabase не настроен: облачные идеи пока недоступны.";
    }
    if (status === 401 || status === 403 || code === "42501" || message.includes("permission denied") || message.includes("rls")) {
      return "Не удалось открыть облачные идеи: нет доступа к этим данным.";
    }
    if (message.includes("failed to fetch") || message.includes("network")) {
      return "Не удалось загрузить облачные идеи. Проверьте интернет и попробуйте ещё раз.";
    }
    if (message.includes("invalid_travel_idea_collection")) {
      return "Эта подборка недоступна. Выберите другую подборку.";
    }
    return "Не удалось выполнить действие с идеями. Попробуйте ещё раз.";
  }

  function fetchTravelIdeaCollections(client) {
    assertSupabaseClient(client);
    return unwrapSupabaseResult(
      client
        .from(COLLECTIONS_TABLE)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      "travel_idea_collections_fetch_failed",
    );
  }

  function fetchInboxTravelIdeas(client) {
    assertSupabaseClient(client);
    return unwrapSupabaseResult(
      client
        .from(IDEAS_TABLE)
        .select("*")
        .eq("status", "inbox")
        .order("created_at", { ascending: false }),
      "travel_ideas_fetch_failed",
    );
  }

  function insertTravelIdeaCollection(client, payload) {
    assertSupabaseClient(client);
    return unwrapSupabaseResult(
      client
        .from(COLLECTIONS_TABLE)
        .insert(payload)
        .select("*")
        .single(),
      "travel_idea_collection_insert_failed",
    );
  }

  function insertTravelIdea(client, payload) {
    assertSupabaseClient(client);
    return unwrapSupabaseResult(
      client
        .from(IDEAS_TABLE)
        .insert(payload)
        .select("*")
        .single(),
      "travel_idea_insert_failed",
    );
  }

  function updateTravelIdea(client, ideaId, patch) {
    assertSupabaseClient(client);
    return unwrapSupabaseResult(
      client
        .from(IDEAS_TABLE)
        .update(patch)
        .eq("id", ideaId)
        .select("*")
        .single(),
      "travel_idea_update_failed",
    );
  }

  function archiveTravelIdea(client, ideaId) {
    return updateTravelIdea(client, ideaId, { status: "archived" });
  }

  const api = {
    COLLECTIONS_TABLE,
    IDEAS_TABLE,
    archiveTravelIdea,
    fetchInboxTravelIdeas,
    fetchTravelIdeaCollections,
    getTravelIdeasClientErrorMessage,
    insertTravelIdea,
    insertTravelIdeaCollection,
    updateTravelIdea,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerTravelIdeasClient = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
