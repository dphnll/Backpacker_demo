(function initTripItemAttachmentsCore(root) {
  "use strict";

  const ATTACHMENTS_BUCKET = "trip-item-attachments";
  const ATTACHMENTS_TABLE = "trip_item_attachments";
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const MIME_TYPES = Object.freeze({
    "application/pdf": { extension: "pdf", label: "PDF" },
    "image/jpeg": { extension: "jpg", label: "JPEG" },
    "image/png": { extension: "png", label: "PNG" },
    "image/webp": { extension: "webp", label: "WebP" },
  });

  function attachmentError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function normalizeScopeId(value, code) {
    const normalized = String(value || "").trim();
    if (!ID_PATTERN.test(normalized)) throw attachmentError(code);
    return normalized;
  }

  function normalizeUuid(value, code) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) throw attachmentError(code);
    return normalized;
  }

  function normalizeAttachmentScope(input = {}) {
    return {
      tripId: normalizeScopeId(input.tripId ?? input.trip_id, "attachment_trip_id_invalid"),
      tripItemId: normalizeScopeId(input.tripItemId ?? input.trip_item_id, "attachment_trip_item_id_invalid"),
    };
  }

  function normalizeFileName(value) {
    const normalized = String(value || "").trim();
    if (!normalized || normalized.length > 255 || /[\u0000-\u001f\u007f]/.test(normalized)) {
      throw attachmentError("attachment_file_name_invalid");
    }
    return normalized;
  }

  function validateAttachmentFile(file = {}) {
    const fileName = normalizeFileName(file.name);
    const mimeType = String(file.type || "").trim().toLowerCase();
    const config = MIME_TYPES[mimeType];
    if (!config) throw attachmentError("attachment_file_type_unsupported");
    const fileSizeBytes = Number(file.size);
    if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1) {
      throw attachmentError("attachment_file_empty");
    }
    if (fileSizeBytes > MAX_ATTACHMENT_BYTES) {
      throw attachmentError("attachment_file_too_large");
    }
    return {
      extension: config.extension,
      fileName,
      fileSizeBytes,
      mimeType,
    };
  }

  function buildAttachmentStoragePath(input = {}) {
    const ownerUserId = normalizeUuid(input.ownerUserId ?? input.owner_user_id, "attachment_owner_id_invalid");
    const attachmentId = normalizeUuid(input.attachmentId ?? input.id, "attachment_id_invalid");
    const { tripId, tripItemId } = normalizeAttachmentScope(input);
    const mimeType = String((input.mimeType ?? input.mime_type) || "").trim().toLowerCase();
    const config = MIME_TYPES[mimeType];
    if (!config) throw attachmentError("attachment_file_type_unsupported");
    return `${ownerUserId}/${tripId}/${tripItemId}/${attachmentId}.${config.extension}`;
  }

  function normalizeAttachmentRow(row = {}) {
    const id = normalizeUuid(row.id, "attachment_id_invalid");
    const ownerUserId = row.owner_user_id
      ? normalizeUuid(row.owner_user_id, "attachment_owner_id_invalid")
      : "";
    const { tripId, tripItemId } = normalizeAttachmentScope(row);
    const fileName = normalizeFileName(row.file_name ?? row.fileName);
    const mimeType = String((row.mime_type ?? row.mimeType) || "").trim().toLowerCase();
    if (!MIME_TYPES[mimeType]) throw attachmentError("attachment_file_type_unsupported");
    const fileSizeBytes = Number(row.file_size_bytes ?? row.fileSizeBytes);
    if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > MAX_ATTACHMENT_BYTES) {
      throw attachmentError("attachment_file_size_invalid");
    }
    const storagePath = String((row.storage_path ?? row.storagePath) || "").trim();
    if (!storagePath || storagePath.includes("//") || /^https?:\/\//i.test(storagePath)) {
      throw attachmentError("attachment_storage_path_invalid");
    }
    return {
      createdAt: String((row.created_at ?? row.createdAt) || ""),
      fileName,
      fileSizeBytes,
      id,
      mimeType,
      ownerUserId,
      storagePath,
      tripId,
      tripItemId,
    };
  }

  function getAttachmentTypeLabel(mimeType) {
    return MIME_TYPES[String(mimeType || "").toLowerCase()]?.label || "Файл";
  }

  // Only the supported image types can be shown as a preview; a PDF keeps its file row.
  function isPreviewableAttachment(mimeType) {
    return String(mimeType || "").toLowerCase().startsWith("image/");
  }

  function formatAttachmentSize(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} МБ`;
  }

  const api = {
    ATTACHMENTS_BUCKET,
    ATTACHMENTS_TABLE,
    MAX_ATTACHMENT_BYTES,
    MIME_TYPES,
    buildAttachmentStoragePath,
    formatAttachmentSize,
    getAttachmentTypeLabel,
    isPreviewableAttachment,
    normalizeAttachmentRow,
    normalizeAttachmentScope,
    validateAttachmentFile,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BackpackerTripItemAttachments = api;
})(typeof window !== "undefined" ? window : globalThis);
