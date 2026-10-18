import fs from "fs";
import path from "path";
import { z } from "zod";

const META_GRAPH_API_VERSION = "v22.0";
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "whatsapp");

/**
 * Idempotently ensures the local uploads directory exists.
 */
function ensureUploadsDir(): void {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("[Meta WhatsApp] Error creando directorio de uploads:", err);
  }
}

// ----------------------------------------------------
// Zod Schemas & Types
// ----------------------------------------------------

export const MetaApiResponseSchema = z.object({
  messaging_product: z.string().optional(),
  contacts: z.array(z.object({ input: z.string(), wa_id: z.string() })).optional(),
  messages: z.array(z.object({ id: z.string() })).optional(),
  error: z
    .object({
      message: z.string(),
      type: z.string().optional(),
      code: z.number().optional(),
      error_subcode: z.number().optional(),
      fbtrace_id: z.string().optional(),
    })
    .optional(),
});

export type MetaApiResponse = z.infer<typeof MetaApiResponseSchema>;

export const MetaMediaUploadResponseSchema = z.object({
  id: z.string().optional(),
  error: z
    .object({
      message: z.string(),
      code: z.number().optional(),
    })
    .optional(),
});

export type MetaMediaUploadResponse = z.infer<typeof MetaMediaUploadResponseSchema>;

export const MetaMediaInfoResponseSchema = z.object({
  url: z.string().optional(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  file_size: z.number().optional(),
  id: z.string().optional(),
  error: z
    .object({
      message: z.string(),
      code: z.number().optional(),
    })
    .optional(),
});

export type MetaMediaInfoResponse = z.infer<typeof MetaMediaInfoResponseSchema>;

export const MetaWhatsAppResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export type MetaWhatsAppResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

export const SendTextMessageParamsSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID es requerido"),
  accessToken: z.string().min(1, "Access Token es requerido"),
  to: z.string().min(1, "Número destinatario es requerido"),
  text: z.string().min(1, "El texto del mensaje no puede estar vacío"),
  previewUrl: z.boolean().optional().default(false),
});

export type SendTextMessageParams = z.input<typeof SendTextMessageParamsSchema>;

export const UploadMediaParamsSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID es requerido"),
  accessToken: z.string().min(1, "Access Token es requerido"),
  fileBuffer: z.instanceof(Buffer),
  mimeType: z.string().min(1, "MIME type es requerido"),
  filename: z.string().min(1, "Nombre de archivo es requerido"),
});

export type UploadMediaParams = z.infer<typeof UploadMediaParamsSchema>;

export const SendMediaMessageParamsSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID es requerido"),
  accessToken: z.string().min(1, "Access Token es requerido"),
  to: z.string().min(1, "Número destinatario es requerido"),
  mediaType: z.enum(["image", "video", "audio", "document", "sticker"]),
  mediaId: z.string().optional(),
  mediaLink: z
    .string()
    .transform((val) => {
      if (!val) return val;
      if (val.startsWith("http://") || val.startsWith("https://")) return val;
      const publicBase = (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "https://omnichannel.farfalina.tech"
      ).replace(/\/+$/, "");
      const cleanPath = val.startsWith("/") ? val : `/${val}`;
      return `${publicBase}${cleanPath}`;
    })
    .pipe(z.string().url("mediaLink debe ser una URL válida"))
    .optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
});

export type SendMediaMessageParams = z.infer<typeof SendMediaMessageParamsSchema>;

export const SendMediaFromBase64ParamsSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID es requerido"),
  accessToken: z.string().min(1, "Access Token es requerido"),
  to: z.string().min(1, "Número destinatario es requerido"),
  base64: z.string().min(1, "Contenido Base64 es requerido"),
  mimeType: z.string().min(1, "MIME type es requerido"),
  filename: z.string().optional(),
  caption: z.string().optional(),
  mediaType: z.enum(["image", "video", "audio", "document", "sticker"]).optional(),
});

export type SendMediaFromBase64Params = z.infer<typeof SendMediaFromBase64ParamsSchema>;

export const DownloadMediaParamsSchema = z.object({
  mediaId: z.string().min(1, "Media ID es requerido"),
  accessToken: z.string().min(1, "Access Token es requerido"),
  filenamePrefix: z.string().default("wa_in"),
});

export type DownloadMediaParams = z.infer<typeof DownloadMediaParamsSchema>;

export const MarkAsReadParamsSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID es requerido"),
  accessToken: z.string().min(1, "Access Token es requerido"),
  messageId: z.string().min(1, "Message ID es requerido"),
});

export type MarkAsReadParams = z.infer<typeof MarkAsReadParamsSchema>;

// ----------------------------------------------------
// Utility Helpers
// ----------------------------------------------------

/**
 * Maps MIME types to clean standard file extensions.
 */
function getExtFromMimeType(mimeType: string): string {
  const cleanMime = mimeType.toLowerCase().split(";")[0]?.trim() || "";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };

  if (map[cleanMime]) return map[cleanMime];
  const subtype = cleanMime.split("/")[1]?.replace(/[^a-z0-9]/gi, "");
  return subtype || "bin";
}

/**
 * Normalizes phone numbers for Meta WhatsApp Cloud API.
 * Ensures international country code without '+' or special characters.
 * Example for Bolivia: 70000000 -> 59170000000; +591 70000000 -> 59170000000.
 *
 * @param rawPhone - Phone number with or without formatting
 * @returns Clean international digits string
 */
export function normalizeWhatsAppPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";

  // Bolivian standard 8-digit mobile (starts with 6 or 7)
  if (digits.length === 8 && (digits.startsWith("6") || digits.startsWith("7"))) {
    return `591${digits}`;
  }

  // Already prefixed with 591 and 11 digits
  if (digits.startsWith("591") && digits.length === 11) {
    return digits;
  }

  // General E.164 without leading zeros
  return digits.replace(/^0+/, "");
}

/**
 * Human-readable phone formatting for UI presentation.
 *
 * @param rawPhone - Phone number string
 * @returns Formatted representation (e.g. +591 7000 0000)
 */
export function formatWhatsAppPhoneDisplay(rawPhone: string): string {
  const normalized = normalizeWhatsAppPhone(rawPhone);
  if (!normalized) return rawPhone;

  if (normalized.startsWith("591") && normalized.length === 11) {
    return `+591 ${normalized.slice(3, 7)} ${normalized.slice(7)}`;
  }
  if (normalized.length === 8) {
    return `+591 ${normalized.slice(0, 4)} ${normalized.slice(4)}`;
  }
  return `+${normalized}`;
}

function cleanAccessToken(rawToken: string): string {
  return rawToken.trim().replace(/^["']|["']$/g, "");
}

// ----------------------------------------------------
// Meta WhatsApp Cloud API Operations
// ----------------------------------------------------

/**
 * Sends a standard text message via Meta WhatsApp Cloud API v22.0.
 *
 * @param params - Validated text message parameters
 * @returns Object with success status, message ID, or structured error
 */
export async function sendMetaWhatsAppTextMessage(
  params: SendTextMessageParams
): Promise<MetaWhatsAppResult<{ messageId: string }>> {
  try {
    const parsedParams = SendTextMessageParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        success: false,
        error: parsedParams.error.issues[0]?.message || "Parámetros de mensaje de texto inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { phoneNumberId, accessToken, to, text, previewUrl } = parsedParams.data;
    const cleanTo = normalizeWhatsAppPhone(to);
    if (!cleanTo) {
      return { success: false, error: "Número de teléfono destinatario inválido", code: "INVALID_PHONE" };
    }

    const token = cleanAccessToken(accessToken);
    const endpoint = `${META_BASE_URL}/${phoneNumberId}/messages`;

    console.log(`[Meta WhatsApp Cloud] Enviando texto a ${cleanTo} desde Phone ID ${phoneNumberId}: "${text.slice(0, 60)}..."`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: previewUrl,
          body: text,
        },
      }),
    });

    const resJson = await response.json();
    const parsed = MetaApiResponseSchema.safeParse(resJson);

    if (!parsed.success) {
      console.warn("[Meta WhatsApp Cloud] Respuesta no reconocida:", resJson);
      return { success: false, error: "Respuesta inválida de Meta API", code: "INVALID_API_RESPONSE" };
    }

    if (parsed.data.error) {
      console.error(`[Meta WhatsApp Cloud Error] Code ${parsed.data.error.code}: ${parsed.data.error.message}`);
      return {
        success: false,
        error: parsed.data.error.message,
        code: `META_ERROR_${parsed.data.error.code || "UNKNOWN"}`,
      };
    }

    const messageId = parsed.data.messages?.[0]?.id || "";
    return {
      success: true,
      data: { messageId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al enviar mensaje";
    console.error("[Meta WhatsApp Cloud Exception]:", err);
    return { success: false, error: message, code: "SEND_TEXT_EXCEPTION" };
  }
}

/**
 * Uploads a media file (image, video, document, audio) to Meta WhatsApp Cloud API.
 * Returns the media ID that can be sent in messages.
 *
 * @param params - Upload parameters including file buffer, MIME type, and filename
 * @returns Object with success status and Meta media ID
 */
export async function uploadMetaWhatsAppMedia(
  params: UploadMediaParams
): Promise<MetaWhatsAppResult<{ mediaId: string }>> {
  try {
    const parsedParams = UploadMediaParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        success: false,
        error: parsedParams.error.issues[0]?.message || "Parámetros de subida multimedia inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { phoneNumberId, accessToken, fileBuffer, mimeType, filename } = parsedParams.data;
    const token = cleanAccessToken(accessToken);
    const endpoint = `${META_BASE_URL}/${phoneNumberId}/media`;

    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append("file", fileBlob, filename);
    formData.append("type", mimeType);

    console.log(`[Meta WhatsApp Cloud] Subiendo archivo multimedia (${filename}, ${mimeType}, ${fileBuffer.length} bytes)...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const resJson = await response.json();
    const parsed = MetaMediaUploadResponseSchema.safeParse(resJson);

    if (!parsed.success || !parsed.data.id) {
      const errMsg = parsed.success && parsed.data.error ? parsed.data.error.message : "Fallo al subir multimedia a Meta";
      console.error("[Meta WhatsApp Media Upload Error]:", resJson);
      return { success: false, error: errMsg, code: "MEDIA_UPLOAD_FAILED" };
    }

    return {
      success: true,
      data: { mediaId: parsed.data.id },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al subir multimedia";
    console.error("[Meta WhatsApp Media Upload Exception]:", err);
    return { success: false, error: message, code: "MEDIA_UPLOAD_EXCEPTION" };
  }
}

/**
 * Sends a media message via Meta WhatsApp Cloud API using either an uploaded media ID or a public HTTPS URL.
 *
 * @param params - Media message parameters including media source, caption, and recipient
 * @returns Object with success status and message ID
 */
export async function sendMetaWhatsAppMediaMessage(
  params: SendMediaMessageParams
): Promise<MetaWhatsAppResult<{ messageId: string }>> {
  try {
    const parsedParams = SendMediaMessageParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        success: false,
        error: parsedParams.error.issues[0]?.message || "Parámetros de mensaje multimedia inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { phoneNumberId, accessToken, to, mediaType, mediaId, mediaLink, caption, filename } = parsedParams.data;
    const cleanTo = normalizeWhatsAppPhone(to);
    if (!cleanTo) {
      return { success: false, error: "Número destinatario inválido", code: "INVALID_PHONE" };
    }
    if (!mediaId && !mediaLink) {
      return { success: false, error: "Se requiere mediaId o mediaLink para enviar archivo", code: "MISSING_MEDIA_SOURCE" };
    }

    const token = cleanAccessToken(accessToken);
    const endpoint = `${META_BASE_URL}/${phoneNumberId}/messages`;

    const mediaObject: Record<string, unknown> = {};
    if (mediaId) {
      mediaObject.id = mediaId;
    } else if (mediaLink) {
      mediaObject.link = mediaLink;
    }

    if (caption && mediaType !== "audio" && mediaType !== "sticker") {
      mediaObject.caption = caption;
    }

    if (filename && mediaType === "document") {
      mediaObject.filename = filename;
    }

    console.log(`[Meta WhatsApp Cloud] Enviando multimedia (${mediaType}) a ${cleanTo}...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: mediaType,
        [mediaType]: mediaObject,
      }),
    });

    const resJson = await response.json();
    const parsed = MetaApiResponseSchema.safeParse(resJson);

    if (!parsed.success) {
      return { success: false, error: "Respuesta inesperada de Meta API", code: "INVALID_API_RESPONSE" };
    }

    if (parsed.data.error) {
      console.error(`[Meta WhatsApp Media Send Error] Code ${parsed.data.error.code}: ${parsed.data.error.message}`);
      return {
        success: false,
        error: parsed.data.error.message,
        code: `META_ERROR_${parsed.data.error.code || "UNKNOWN"}`,
      };
    }

    const messageId = parsed.data.messages?.[0]?.id || "";
    return {
      success: true,
      data: { messageId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al enviar multimedia";
    console.error("[Meta WhatsApp Media Send Exception]:", err);
    return { success: false, error: message, code: "SEND_MEDIA_EXCEPTION" };
  }
}

/**
 * High-level helper: Decodes Base64 data, uploads to Meta Media endpoint, and sends the message.
 *
 * @param params - Base64 payload, recipient, MIME type, and optional caption
 * @returns Object with success status, message ID, and media ID
 */
export async function sendMetaWhatsAppMediaFromBase64(
  params: SendMediaFromBase64Params
): Promise<MetaWhatsAppResult<{ messageId: string; mediaId: string }>> {
  try {
    const parsedParams = SendMediaFromBase64ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        success: false,
        error: parsedParams.error.issues[0]?.message || "Parámetros de Base64 inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { phoneNumberId, accessToken, to, base64, mimeType, filename, caption, mediaType } = parsedParams.data;
    const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
    const buffer = Buffer.from(cleanBase64, "base64");
    const ext = getExtFromMimeType(mimeType);
    const safeFilename = filename || `file_${Date.now()}.${ext}`;

    let resolvedType: "image" | "video" | "audio" | "document" | "sticker" = mediaType || "document";
    if (!mediaType) {
      if (mimeType.startsWith("image/")) resolvedType = "image";
      else if (mimeType.startsWith("video/")) resolvedType = "video";
      else if (mimeType.startsWith("audio/")) resolvedType = "audio";
      else resolvedType = "document";
    }

    const uploadRes = await uploadMetaWhatsAppMedia({
      phoneNumberId,
      accessToken,
      fileBuffer: buffer,
      mimeType,
      filename: safeFilename,
    });

    if (!uploadRes.success || !uploadRes.data?.mediaId) {
      return { success: false, error: uploadRes.error || "Fallo en la carga del archivo", code: uploadRes.code };
    }

    const sendRes = await sendMetaWhatsAppMediaMessage({
      phoneNumberId,
      accessToken,
      to,
      mediaType: resolvedType,
      mediaId: uploadRes.data.mediaId,
      caption,
      filename: safeFilename,
    });

    if (!sendRes.success || !sendRes.data?.messageId) {
      return { success: false, error: sendRes.error || "Fallo al enviar mensaje multimedia", code: sendRes.code };
    }

    return {
      success: true,
      data: {
        messageId: sendRes.data.messageId,
        mediaId: uploadRes.data.mediaId,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al procesar y enviar base64 a Meta";
    return { success: false, error: message, code: "BASE64_SEND_EXCEPTION" };
  }
}

/**
 * Downloads inbound media from Meta WhatsApp Cloud API and caches it locally in public/uploads/whatsapp/.
 *
 * @param params - Media ID, access token, and optional filename prefix
 * @returns Object with local relative URL, MIME type, and byte size
 */
export async function downloadMetaWhatsAppMedia(
  params: DownloadMediaParams
): Promise<MetaWhatsAppResult<{ localUrl: string; mimeType: string; fileSize: number }>> {
  try {
    const parsedParams = DownloadMediaParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        success: false,
        error: parsedParams.error.issues[0]?.message || "Parámetros de descarga inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { mediaId, accessToken, filenamePrefix } = parsedParams.data;
    const token = cleanAccessToken(accessToken);

    // Ensure uploads directory exists
    ensureUploadsDir();

    // Step 1: Query media details to get download URL
    const metaUrl = `${META_BASE_URL}/${mediaId}`;
    const infoRes = await fetch(metaUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const infoJson = await infoRes.json();
    const parsed = MetaMediaInfoResponseSchema.safeParse(infoJson);

    if (!parsed.success || !parsed.data.url) {
      console.error("[Meta WhatsApp Download] No se obtuvo URL de descarga:", infoJson);
      return { success: false, error: "No se pudo obtener la URL de descarga del medio", code: "MEDIA_URL_NOT_FOUND" };
    }

    const downloadUrl = parsed.data.url;
    const mimeType = parsed.data.mime_type || "application/octet-stream";
    const ext = getExtFromMimeType(mimeType);
    const filename = `${filenamePrefix}_${Date.now()}_${mediaId.slice(-6)}.${ext}`;
    const localFilePath = path.join(UPLOADS_DIR, filename);

    // Step 2: Download raw binary stream (Meta lookaside requires Bearer token)
    const fileRes = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "curl/7.68.0",
      },
    });

    if (!fileRes.ok) {
      console.error(`[Meta WhatsApp Download] Fallo HTTP ${fileRes.status} al descargar archivo binario.`);
      return { success: false, error: `Error HTTP al descargar archivo (${fileRes.status})`, code: "DOWNLOAD_FAILED" };
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(localFilePath, buffer);

    console.log(`[Meta WhatsApp Media] Archivo guardado localmente: /uploads/whatsapp/${filename} (${buffer.length} bytes)`);

    return {
      success: true,
      data: {
        localUrl: `/uploads/whatsapp/${filename}`,
        mimeType,
        fileSize: buffer.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al descargar multimedia de Meta";
    console.error("[Meta WhatsApp Download Exception]:", err);
    return { success: false, error: message, code: "DOWNLOAD_EXCEPTION" };
  }
}

/**
 * Marks an incoming WhatsApp message as 'read' in Meta WhatsApp Cloud API.
 *
 * @param params - Phone number ID, access token, and message ID to mark as read
 * @returns Object with success status
 */
export async function markMetaWhatsAppMessageAsRead(
  params: MarkAsReadParams
): Promise<MetaWhatsAppResult<boolean>> {
  try {
    const parsedParams = MarkAsReadParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return { success: false, error: "Parámetros inválidos", code: "VALIDATION_ERROR" };
    }

    const { phoneNumberId, accessToken, messageId } = parsedParams.data;
    const token = cleanAccessToken(accessToken);
    const endpoint = `${META_BASE_URL}/${phoneNumberId}/messages`;

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });

    return { success: true, data: true };
  } catch {
    // Non-blocking fail-safe
    return { success: false, error: "Fallo al marcar como leído" };
  }
}
