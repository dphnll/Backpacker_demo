(function initTripItemAttachmentsClient(root) {
  "use strict";

  const core = typeof module !== "undefined" && module.exports
    ? require("./trip-item-attachments-core.js")
    : root.BackpackerTripItemAttachments;

  const ATTACHMENT_COLUMNS = "id, trip_id, trip_item_id, file_name, mime_type, file_size_bytes, storage_path, created_at";

  function clientError(error, fallback) {
    const wrapped = new Error(error?.message || fallback);
    wrapped.code = error?.code || fallback;
    wrapped.status = error?.status || error?.statusCode || 0;
    return wrapped;
  }

  function assertClient(client) {
    if (!client?.from || !client?.storage?.from || !client?.auth?.getUser) {
      throw clientError(null, "supabase_not_configured");
    }
  }

  async function getCurrentOwnerUserId(client) {
    assertClient(client);
    const result = await client.auth.getUser();
    if (result?.error) throw clientError(result.error, "attachment_auth_failed");
    const ownerUserId = result?.data?.user?.id || "";
    if (!ownerUserId) throw clientError(null, "attachment_auth_required");
    return ownerUserId;
  }

  async function listTripItemAttachments(client, scope) {
    assertClient(client);
    const { tripId, tripItemId } = core.normalizeAttachmentScope(scope);
    const result = await client
      .from(core.ATTACHMENTS_TABLE)
      .select(ATTACHMENT_COLUMNS)
      .eq("trip_id", tripId)
      .eq("trip_item_id", tripItemId)
      .order("created_at", { ascending: true });
    if (result?.error) throw clientError(result.error, "attachment_list_failed");
    return (result?.data || []).map(core.normalizeAttachmentRow);
  }

  async function uploadTripItemAttachment(client, scope, file, options = {}) {
    assertClient(client);
    const normalizedScope = core.normalizeAttachmentScope(scope);
    const normalizedFile = core.validateAttachmentFile(file);
    const ownerUserId = await getCurrentOwnerUserId(client);
    const randomUuid = options.randomUuid || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
    if (!randomUuid) throw clientError(null, "attachment_uuid_unavailable");
    const attachmentId = randomUuid();
    const storagePath = core.buildAttachmentStoragePath({
      ...normalizedScope,
      attachmentId,
      mimeType: normalizedFile.mimeType,
      ownerUserId,
    });
    const bucket = client.storage.from(core.ATTACHMENTS_BUCKET);
    const uploadResult = await bucket.upload(storagePath, file, {
      cacheControl: "3600",
      contentType: normalizedFile.mimeType,
      upsert: false,
    });
    if (uploadResult?.error) throw clientError(uploadResult.error, "attachment_upload_failed");

    const payload = {
      id: attachmentId,
      trip_id: normalizedScope.tripId,
      trip_item_id: normalizedScope.tripItemId,
      file_name: normalizedFile.fileName,
      mime_type: normalizedFile.mimeType,
      file_size_bytes: normalizedFile.fileSizeBytes,
      storage_path: storagePath,
    };
    const metadataResult = await client
      .from(core.ATTACHMENTS_TABLE)
      .insert(payload)
      .select(ATTACHMENT_COLUMNS)
      .single();
    if (metadataResult?.error) {
      await bucket.remove([storagePath]).catch(() => null);
      throw clientError(metadataResult.error, "attachment_metadata_create_failed");
    }
    return core.normalizeAttachmentRow(metadataResult.data);
  }

  async function createTripItemAttachmentSignedUrl(client, attachment, expiresIn = 120) {
    assertClient(client);
    const normalized = core.normalizeAttachmentRow(attachment);
    const result = await client.storage
      .from(core.ATTACHMENTS_BUCKET)
      .createSignedUrl(normalized.storagePath, expiresIn);
    if (result?.error || !result?.data?.signedUrl) {
      throw clientError(result?.error, "attachment_signed_url_failed");
    }
    const signedUrl = String(result.data.signedUrl);
    if (!/^https?:\/\//i.test(signedUrl)) throw clientError(null, "attachment_signed_url_invalid");
    return signedUrl;
  }

  async function deleteTripItemAttachment(client, attachment) {
    assertClient(client);
    const normalized = core.normalizeAttachmentRow(attachment);
    const bucket = client.storage.from(core.ATTACHMENTS_BUCKET);
    const storageResult = await bucket.remove([normalized.storagePath]);
    if (storageResult?.error) throw clientError(storageResult.error, "attachment_storage_delete_failed");

    const metadataResult = await client
      .from(core.ATTACHMENTS_TABLE)
      .delete()
      .eq("id", normalized.id)
      .eq("storage_path", normalized.storagePath)
      .select("id");
    if (metadataResult?.error || metadataResult?.data?.length !== 1) {
      throw clientError(metadataResult?.error, "attachment_metadata_delete_failed");
    }
    return normalized.id;
  }

  function getTripItemAttachmentErrorMessage(error) {
    const code = String(error?.code || error?.message || "").toLowerCase();
    if (code.includes("file_type_unsupported")) return "Можно прикрепить PDF, JPEG, PNG или WebP.";
    if (code.includes("file_too_large")) return "Файл слишком большой. Максимальный размер — 10 МБ.";
    if (code.includes("file_empty") || code.includes("file_name_invalid")) return "Не удалось прочитать этот файл.";
    if (code.includes("auth") || Number(error?.status) === 401 || Number(error?.status) === 403) {
      return "Не удалось получить доступ к вложениям. Обновите страницу и попробуйте ещё раз.";
    }
    if (code.includes("list")) return "Не удалось загрузить вложения.";
    if (code.includes("delete")) return "Не удалось удалить вложение. Попробуйте ещё раз.";
    if (code.includes("signed_url")) return "Не удалось открыть вложение. Попробуйте ещё раз.";
    return "Не удалось загрузить вложение. Попробуйте ещё раз.";
  }

  const api = {
    ATTACHMENT_COLUMNS,
    createTripItemAttachmentSignedUrl,
    deleteTripItemAttachment,
    getCurrentOwnerUserId,
    getTripItemAttachmentErrorMessage,
    listTripItemAttachments,
    uploadTripItemAttachment,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BackpackerTripItemAttachmentsClient = api;
})(typeof window !== "undefined" ? window : globalThis);
