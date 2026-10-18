import fs from "fs";
import path from "path";
import { z } from "zod";

const META_GRAPH_VERSION = "v22.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// Ensure uploads base directories exist
function ensureDirectory(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.warn(`[Meta Graph API] Error creando directorio ${dirPath}:`, err);
  }
}

export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

/**
 * Resolves Instagram Graph API attachment type ('image' | 'video' | 'audio' | 'file') from MIME type.
 */
export function getInstagramMediaType(mimeType: string): "image" | "video" | "audio" | "file" {
  const lower = (mimeType || "").toLowerCase().trim();
  if (lower.startsWith("video/")) {
    return "video";
  }
  if (lower.startsWith("audio/")) {
    return "audio";
  }
  if (
    lower.startsWith("application/") ||
    lower.includes("pdf") ||
    lower.includes("document") ||
    lower.includes("sheet") ||
    lower.includes("excel") ||
    lower.includes("word") ||
    lower.startsWith("text/") ||
    lower === "file" ||
    lower === "document"
  ) {
    return "file";
  }
  return "image";
}

/**
 * Resolves an absolute public HTTPS URL accessible through the tunnel.
 */
export function resolvePublicMediaUrl(mediaUrl: string): string {
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    return mediaUrl.trim();
  }
  const publicBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://omnichannel.farfalina.tech"
  ).replace(/\/+$/, "");
  const cleanPath = mediaUrl.startsWith("/") ? mediaUrl : `/${mediaUrl}`;
  return `${publicBaseUrl}${cleanPath}`;
}

/**
 * Downloads media from Meta ephemeral CDN URL and saves it permanently to disk.
 */
export async function downloadAndCacheMetaMedia(params: {
  url: string;
  folder: "facebook" | "instagram" | "whatsapp";
  filenamePrefix: string;
  accessToken?: string | null;
}): Promise<{ localUrl: string; mimeType: string; filename: string } | null> {
  const { url, folder, filenamePrefix, accessToken } = params;
  if (!url || !url.startsWith("http")) return null;

  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    ensureDirectory(uploadDir);

    const headers: Record<string, string> = {
      "User-Agent": "FloreriaCarissma-Omnichannel/2.0",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[Meta Graph API] Falló descarga de media (${res.status}): ${url}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const cleanMime = contentType.split(";")[0].trim().toLowerCase();
    const ext = MIME_TO_EXT[cleanMime] || "bin";

    const filename = `${filenamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    const buffer = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const localUrl = `/uploads/${folder}/${filename}`;
    return {
      localUrl,
      mimeType: cleanMime,
      filename,
    };
  } catch (err) {
    console.error("[Meta Graph API] Error al descargar media de Meta:", err);
    return null;
  }
}

/**
 * Verifies a Facebook Page Access Token via Graph API /me.
 */
export async function verifyFacebookPageToken(token: string): Promise<{
  valid: boolean;
  pageId?: string;
  pageName?: string;
  error?: string;
}> {
  try {
    const cleanToken = token.trim().replace(/^["']|["']$/g, "");
    if (!cleanToken) return { valid: false, error: "Token vacío" };

    const url = `${META_GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(cleanToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (data.error) {
      return { valid: false, error: data.error.message || "Token inválido en Meta" };
    }

    return {
      valid: true,
      pageId: data.id,
      pageName: data.name,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Error al contactar Facebook Graph API",
    };
  }
}

/**
 * Verifies an Instagram Access Token / Account ID via Graph API.
 * Supports both Instagram User tokens (IGAA...) via graph.instagram.com
 * and Facebook Page tokens via graph.facebook.com.
 */
export async function verifyInstagramToken(
  token: string,
  accountId?: string
): Promise<{
  valid: boolean;
  accountId?: string;
  username?: string;
  error?: string;
}> {
  try {
    const cleanToken = token.trim().replace(/^["']|["']$/g, "");
    if (!cleanToken) return { valid: false, error: "Token vacío" };

    // 1. Si el token empieza por IGAA o IG, es un token nativo de Instagram Graph API
    if (cleanToken.startsWith("IGAA") || cleanToken.startsWith("IG")) {
      const igUrl = `https://graph.instagram.com/v22.0/me?fields=id,username,account_type&access_token=${encodeURIComponent(cleanToken)}`;
      const igRes = await fetch(igUrl, { signal: AbortSignal.timeout(8000) });
      const igData = await igRes.json();

      if (!igData.error && igData.id) {
        return {
          valid: true,
          accountId: igData.id,
          username: igData.username,
        };
      }
    }

    // 2. Intentar vía Facebook Graph API (para tokens de página EAA...)
    const target = accountId ? accountId.trim() : "me";
    const url = `${META_GRAPH_BASE}/${target}?fields=id,username,name&access_token=${encodeURIComponent(cleanToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (data.error) {
      // Fallback secundario a graph.instagram.com si falló en facebook graph
      const igFallbackUrl = `https://graph.instagram.com/v22.0/me?fields=id,username&access_token=${encodeURIComponent(cleanToken)}`;
      const igRes2 = await fetch(igFallbackUrl, { signal: AbortSignal.timeout(8000) });
      const igData2 = await igRes2.json();

      if (!igData2.error && igData2.id) {
        return {
          valid: true,
          accountId: igData2.id,
          username: igData2.username,
        };
      }

      return { valid: false, error: data.error.message || "Token inválido para Instagram en Meta" };
    }

    return {
      valid: true,
      accountId: data.id,
      username: data.username || data.name,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Error al contactar Instagram Graph API",
    };
  }
}

/**
 * Sends a text message to a Facebook Messenger recipient (PSID).
 */
export async function sendFacebookMessengerTextMessage(params: {
  pageAccessToken: string;
  recipientPsid: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { pageAccessToken, recipientPsid, text } = params;
  try {
    const cleanToken = pageAccessToken.trim().replace(/^["']|["']$/g, "");
    const cleanPsid = recipientPsid.trim();

    if (!cleanToken || !cleanPsid || !text) {
      return { success: false, error: "Parámetros insuficientes para Facebook Messenger" };
    }

    const payload = {
      recipient: { id: cleanPsid },
      messaging_type: "RESPONSE",
      message: { text },
    };

    const url = `${META_GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(cleanToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg = data.error?.message || `HTTP ${res.status}`;
      console.warn(`[Facebook Messenger Outbound] Error al enviar mensaje:`, data.error);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: data.message_id || `fb_msg_${Date.now()}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red al enviar a Facebook Messenger";
    return { success: false, error: msg };
  }
}

/**
 * Sends a media attachment to a Facebook Messenger recipient (PSID).
 * Supports multipart buffer upload (works even without public URLs) or hosted URL payload.
 */
export async function sendFacebookMessengerMediaMessage(params: {
  pageAccessToken: string;
  recipientPsid: string;
  buffer?: Buffer;
  mimeType: string;
  filename?: string;
  mediaUrl?: string;
  caption?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { pageAccessToken, recipientPsid, buffer, mimeType, filename, mediaUrl, caption } = params;
  try {
    const cleanToken = pageAccessToken.trim().replace(/^["']|["']$/g, "");
    const cleanPsid = recipientPsid.trim();

    let metaMediaType: "image" | "video" | "audio" | "file" = "file";
    if (mimeType.startsWith("image/")) metaMediaType = "image";
    else if (mimeType.startsWith("video/")) metaMediaType = "video";
    else if (mimeType.startsWith("audio/")) metaMediaType = "audio";

    // Method 1: Multipart FormData upload if buffer is available
    if (buffer && buffer.length > 0) {
      const form = new FormData();
      form.append("recipient", JSON.stringify({ id: cleanPsid }));
      form.append(
        "message",
        JSON.stringify({
          attachment: {
            type: metaMediaType,
            payload: { is_reusable: true },
          },
        })
      );

      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      form.append("filedata", blob, filename || `attachment.${MIME_TO_EXT[mimeType] || "bin"}`);

      const url = `${META_GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(cleanToken)}`;
      const res = await fetch(url, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error?.message || "Error al subir archivo a Facebook" };
      }

      // If there was a text caption, send it as a follow-up message
      if (caption && caption.trim()) {
        await sendFacebookMessengerTextMessage({
          pageAccessToken: cleanToken,
          recipientPsid: cleanPsid,
          text: caption.trim(),
        });
      }

      return { success: true, messageId: data.message_id || `fb_media_${Date.now()}` };
    }

    // Method 2: Public URL attachment payload
    if (mediaUrl && mediaUrl.startsWith("http")) {
      const payload = {
        recipient: { id: cleanPsid },
        messaging_type: "RESPONSE",
        message: {
          attachment: {
            type: metaMediaType,
            payload: { url: mediaUrl, is_reusable: true },
          },
        },
      };

      const url = `${META_GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(cleanToken)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error?.message || "Error al enviar URL a Facebook" };
      }

      if (caption && caption.trim()) {
        await sendFacebookMessengerTextMessage({
          pageAccessToken: cleanToken,
          recipientPsid: cleanPsid,
          text: caption.trim(),
        });
      }

      return { success: true, messageId: data.message_id || `fb_media_${Date.now()}` };
    }

    return { success: false, error: "Sin datos válidos para adjunto multimedia" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al enviar multimedia a Facebook";
    return { success: false, error: msg };
  }
}

/**
 * Sends a text message to an Instagram Direct recipient (IGSID).
 */
export async function sendInstagramDirectTextMessage(params: {
  accessToken: string;
  recipientIgsid: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { accessToken, recipientIgsid, text } = params;
  try {
    const cleanToken = accessToken.trim().replace(/^["']|["']$/g, "");
    const cleanIgsid = recipientIgsid.trim();

    if (!cleanToken || !cleanIgsid || !text) {
      return { success: false, error: "Parámetros insuficientes para Instagram Direct" };
    }

    const payload = {
      recipient: { id: cleanIgsid },
      message: { text },
    };

    const isFacebookPageToken = cleanToken.startsWith("EA");
    const baseUrl = isFacebookPageToken ? META_GRAPH_BASE : "https://graph.instagram.com/v22.0";
    const url = `${baseUrl}/me/messages?access_token=${encodeURIComponent(cleanToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.warn(`[Instagram Direct Outbound] Error al enviar mensaje:`, data.error);
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }

    return {
      success: true,
      messageId: data.message_id || `ig_msg_${Date.now()}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al enviar a Instagram Direct";
    return { success: false, error: msg };
  }
}

/**
 * Sends a media attachment to an Instagram Direct recipient (IGSID).
 *
 * Instagram Direct Send API strictly requires public HTTPS URLs in attachment payloads
 * and targets https://graph.instagram.com/v22.0/me/messages for IGAA user tokens.
 */
export async function sendInstagramDirectMediaMessage(params: {
  accessToken: string;
  recipientIgsid: string;
  buffer?: Buffer;
  mimeType: string;
  filename?: string;
  mediaUrl?: string;
  caption?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { accessToken, recipientIgsid, buffer, mimeType, filename, mediaUrl, caption } = params;
  try {
    const cleanToken = accessToken.trim().replace(/^["']|["']$/g, "");
    const cleanIgsid = recipientIgsid.trim();

    if (!cleanToken || !cleanIgsid) {
      return { success: false, error: "Token de acceso y destinatario son requeridos" };
    }

    // Resolve attachment type: 'image' | 'video' | 'audio' | 'file'
    const metaMediaType = getInstagramMediaType(mimeType);

    let resolvedMediaUrl: string | null = null;

    if (mediaUrl && mediaUrl.trim()) {
      resolvedMediaUrl = resolvePublicMediaUrl(mediaUrl.trim());
    } else if (buffer && buffer.length > 0) {
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "instagram");
        ensureDirectory(uploadDir);
        const lowerMime = (mimeType || "").toLowerCase().trim();
        const ext = MIME_TO_EXT[lowerMime] || lowerMime.split("/")[1]?.split(";")[0] || "bin";
        const cleanName = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, "_") : `file_${Date.now()}.${ext}`;
        const fname = `out_${Date.now()}_${cleanName}`;
        const filePath = path.join(uploadDir, fname);
        fs.writeFileSync(filePath, buffer);
        resolvedMediaUrl = resolvePublicMediaUrl(`/uploads/instagram/${fname}`);
      } catch (saveErr) {
        console.warn("[Instagram Direct Media] Error al guardar buffer local para despacho:", saveErr);
      }
    }

    if (!resolvedMediaUrl) {
      return { success: false, error: "Sin URL pública o archivo válido para adjunto de Instagram" };
    }

    const payload = {
      recipient: { id: cleanIgsid },
      message: {
        attachment: {
          type: metaMediaType,
          payload: { url: resolvedMediaUrl },
        },
      },
    };

    // Instagram User Tokens (IGAA...) strictly require graph.instagram.com/v22.0
    // graph.facebook.com rejects IGAA tokens with OAuthException 190
    const isFacebookPageToken = cleanToken.startsWith("EA");
    const baseUrl = isFacebookPageToken ? META_GRAPH_BASE : "https://graph.instagram.com/v22.0";
    const url = `${baseUrl}/me/messages?access_token=${encodeURIComponent(cleanToken)}`;

    console.log(`[Instagram Direct Outbound] Despachando adjunto (${metaMediaType}) a ${cleanIgsid} vía ${baseUrl}/me/messages...`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      console.warn(`[Instagram Direct Outbound] Error al enviar archivo:`, data.error);
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }

    if (caption && caption.trim()) {
      await sendInstagramDirectTextMessage({
        accessToken: cleanToken,
        recipientIgsid: cleanIgsid,
        text: caption.trim(),
      });
    }

    return {
      success: true,
      messageId: data.message_id || `ig_media_${Date.now()}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al enviar multimedia a Instagram";
    return { success: false, error: msg };
  }
}

/**
 * Posts a public reply to an Instagram comment via Meta Graph API v22.0.
 * POST https://graph.instagram.com/v22.0/{comment_id}/replies?message={message}&access_token={token}
 *
 * @param params.accessToken - Active Instagram Graph API token (IGAA... or EA...)
 * @param params.commentId - Instagram comment ID (e.g. "17890123456789012")
 * @param params.message - Reply text message
 */
export async function replyInstagramCommentPublic(params: {
  accessToken: string;
  commentId: string;
  message: string;
}): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const { accessToken, commentId, message } = params;
  try {
    const cleanToken = accessToken.trim().replace(/^["']|["']$/g, "");
    const cleanCommentId = commentId.trim();
    const cleanMessage = message.trim();

    if (!cleanToken || !cleanCommentId || !cleanMessage) {
      return { success: false, error: "Parámetros insuficientes para responder comentario" };
    }

    const isFacebookPageToken = cleanToken.startsWith("EA");
    const baseUrl = isFacebookPageToken ? META_GRAPH_BASE : "https://graph.instagram.com/v22.0";
    const url = `${baseUrl}/${encodeURIComponent(cleanCommentId)}/replies?access_token=${encodeURIComponent(cleanToken)}`;

    console.log(`[Instagram Comment Public Reply] Despachando respuesta a comentario ${cleanCommentId} vía ${baseUrl}...`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: cleanMessage }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      console.warn(`[Instagram Comment Public Reply] Error al responder comentario:`, data.error);
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }

    return {
      success: true,
      replyId: data.id || `ig_reply_${Date.now()}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red al responder comentario en Instagram";
    return { success: false, error: msg };
  }
}

/**
 * Sends a private reply (Direct Message) to an Instagram comment via Meta Graph API v22.0.
 * POST https://graph.instagram.com/v22.0/me/messages with recipient: { comment_id }
 *
 * Note: Meta restricts private replies to 1 per comment and within 7 days of comment creation.
 *
 * @param params.accessToken - Active Instagram Graph API token
 * @param params.commentId - Instagram comment ID
 * @param params.message - Private message text
 */
export async function replyInstagramCommentPrivate(params: {
  accessToken: string;
  commentId: string;
  message: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { accessToken, commentId, message } = params;
  try {
    const cleanToken = accessToken.trim().replace(/^["']|["']$/g, "");
    const cleanCommentId = commentId.trim();
    const cleanMessage = message.trim();

    if (!cleanToken || !cleanCommentId || !cleanMessage) {
      return { success: false, error: "Parámetros insuficientes para respuesta privada de comentario" };
    }

    const isFacebookPageToken = cleanToken.startsWith("EA");
    const baseUrl = isFacebookPageToken ? META_GRAPH_BASE : "https://graph.instagram.com/v22.0";
    const url = `${baseUrl}/me/messages?access_token=${encodeURIComponent(cleanToken)}`;

    const payload = {
      recipient: { comment_id: cleanCommentId },
      message: { text: cleanMessage },
    };

    console.log(`[Instagram Comment Private Reply] Despachando Private Reply a comentario ${cleanCommentId} vía ${baseUrl}...`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      console.warn(`[Instagram Comment Private Reply] Error al enviar Private Reply:`, data.error);
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }

    return {
      success: true,
      messageId: data.message_id || data.id || `ig_priv_reply_${Date.now()}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red al enviar respuesta privada";
    return { success: false, error: msg };
  }
}

/**
 * Fetches recent media posts from an Instagram account via Meta Graph API v22.0.
 */
export async function fetchInstagramMediaFromGraphApi(params: {
  accessToken: string;
  accountId?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp?: string;
    comments_count?: number;
    like_count?: number;
  }>;
  error?: string;
}> {
  const { accessToken, accountId, limit = 25 } = params;
  try {
    const cleanToken = accessToken.trim().replace(/^["']|["']$/g, "");
    if (!cleanToken) return { success: false, error: "Token vacío" };

    const target = accountId ? encodeURIComponent(accountId.trim()) : "me";
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count";
    const isFacebookPageToken = cleanToken.startsWith("EA");
    const baseUrl = isFacebookPageToken ? META_GRAPH_BASE : "https://graph.instagram.com/v22.0";
    const url = `${baseUrl}/${target}/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(cleanToken)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }

    return {
      success: true,
      data: Array.isArray(data.data) ? data.data : [],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error de red al consultar publicaciones de Instagram",
    };
  }
}

/**
 * Fetches comments for a specific Instagram media post via Meta Graph API v22.0.
 */
export async function fetchInstagramCommentsFromGraphApi(params: {
  accessToken: string;
  mediaId: string;
}): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    text: string;
    timestamp: string;
    username?: string;
    from?: { id: string; username: string };
    parent_id?: string;
    replies?: { data: Array<{ id: string; text: string; timestamp: string; username?: string }> };
  }>;
  error?: string;
}> {
  const { accessToken, mediaId } = params;
  try {
    const cleanToken = accessToken.trim().replace(/^["']|["']$/g, "");
    const cleanMediaId = mediaId.trim();
    if (!cleanToken || !cleanMediaId) return { success: false, error: "Parámetros requeridos" };

    const fields = "id,text,timestamp,username,from,parent_id,replies{id,text,timestamp,username,from}";
    const isFacebookPageToken = cleanToken.startsWith("EA");
    const baseUrl = isFacebookPageToken ? META_GRAPH_BASE : "https://graph.instagram.com/v22.0";
    const url = `${baseUrl}/${encodeURIComponent(cleanMediaId)}/comments?fields=${fields}&access_token=${encodeURIComponent(cleanToken)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }

    return {
      success: true,
      data: Array.isArray(data.data) ? data.data : [],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error de red al consultar comentarios del post",
    };
  }
}

/**
 * Zod schemas and types for historical conversations backfill (R4).
 */
export const HistoricalAttachmentSchema = z.object({
  type: z.enum(["image", "video", "audio", "document", "share", "unknown"]),
  url: z.string().optional(),
  previewUrl: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
});
export type HistoricalAttachment = z.infer<typeof HistoricalAttachmentSchema>;

export const HistoricalMessageSchema = z.object({
  id: z.string(),
  created_time: z.string(),
  from: z.object({
    id: z.string(),
    username: z.string().optional(),
  }).optional(),
  to: z.object({
    data: z.array(z.object({
      id: z.string(),
      username: z.string().optional(),
    })).optional(),
  }).optional(),
  message: z.string().optional(),
  attachments: z.array(HistoricalAttachmentSchema).optional(),
});
export type HistoricalMessage = z.infer<typeof HistoricalMessageSchema>;

export const HistoricalConversationSchema = z.object({
  id: z.string(),
  updated_time: z.string(),
  participants: z.array(z.object({
    id: z.string(),
    username: z.string().optional(),
  })),
  messages: z.array(HistoricalMessageSchema),
});
export type HistoricalConversation = z.infer<typeof HistoricalConversationSchema>;

export interface FetchHistoricalConversationsOptions {
  accessToken: string;
  accountId?: string;
  limitConversations?: number; // Total max conversations to return (default: 50)
  maxMessagesPerThread?: number; // Max messages per thread to fetch (default: 100)
}

export interface FetchHistoricalConversationsResult {
  success: boolean;
  data?: HistoricalConversation[];
  error?: string;
}

/**
 * Parses raw Meta Graph API message attachment structures into normalized HistoricalAttachment objects.
 * Handles image_data, video_data, audio_data, file_url, generic_template, and shares.
 */
function parseRawAttachments(rawAttachments: unknown): HistoricalAttachment[] {
  if (!Array.isArray(rawAttachments)) return [];
  const result: HistoricalAttachment[] = [];
  for (const item of rawAttachments) {
    if (!item || typeof item !== "object") continue;
    const typed = item as Record<string, any>;
    if (typed.image_data) {
      result.push({
        type: "image",
        url: typed.image_data.url || typed.image_data.preview_url,
        previewUrl: typed.image_data.preview_url,
      });
    } else if (typed.video_data) {
      result.push({
        type: "video",
        url: typed.video_data.url || typed.video_data.preview_url,
        previewUrl: typed.video_data.preview_url,
      });
    } else if (typed.audio_data) {
      result.push({
        type: "audio",
        url: typed.audio_data.url,
      });
    } else if (typed.file_url) {
      const fileUrl = String(typed.file_url);
      const lower = fileUrl.toLowerCase();
      const isAudio = lower.endsWith(".mp3") || lower.endsWith(".ogg") || lower.endsWith(".m4a");
      result.push({
        type: isAudio ? "audio" : "document",
        url: fileUrl,
      });
    } else if (typed.generic_template) {
      result.push({
        type: typed.generic_template.media_url ? "image" : "document",
        url: typed.generic_template.media_url,
        title: typed.generic_template.title,
        subtitle: typed.generic_template.subtitle,
      });
    } else if (typed.shares) {
      result.push({
        type: "share",
        url: typed.shares.link || typed.shares.url,
        title: typed.shares.title || typed.shares.name,
      });
    } else {
      result.push({
        type: "unknown",
      });
    }
  }
  return result;
}

/**
 * Fetches historical conversations and nested messages from Meta Graph API v22.0.
 *
 * Calls GET https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}&access_token={token}
 * Supports pagination walking paging.next for both conversations and nested messages.
 */
export async function fetchHistoricalInstagramConversations(
  options: FetchHistoricalConversationsOptions
): Promise<FetchHistoricalConversationsResult> {
  const { accessToken, accountId, limitConversations = 50, maxMessagesPerThread = 100 } = options;
  try {
    const cleanToken = accessToken.trim().replace(/^["']|["']$/g, "");
    if (!cleanToken) {
      return { success: false, error: "Token de acceso requerido" };
    }

    const isFacebookPageToken = cleanToken.startsWith("EA");
    const baseUrl = isFacebookPageToken ? META_GRAPH_BASE : "https://graph.instagram.com/v22.0";
    const target = isFacebookPageToken && accountId ? encodeURIComponent(accountId.trim()) : "me";
    const fields = "id,updated_time,participants,messages{id,created_time,from,to,message,attachments}";

    let nextConvUrl: string | null = `${baseUrl}/${target}/conversations?fields=${fields}&access_token=${encodeURIComponent(cleanToken)}`;
    const conversations: HistoricalConversation[] = [];
    let convPages = 0;
    const maxConvPages = Math.ceil(limitConversations / 20) + 2;

    while (nextConvUrl && conversations.length < limitConversations && convPages < maxConvPages) {
      convPages++;

      const currentConvUrl: string = nextConvUrl;
      const res: Response = await fetch(currentConvUrl, { signal: AbortSignal.timeout(15000) });
      const json: any = await res.json().catch(() => ({}));

      if (!res.ok || json.error) {
        const errorMsg = json.error?.message || `HTTP ${res.status} al consultar conversaciones de Instagram`;
        console.warn("[Meta Graph API] Error al obtener conversaciones históricas:", json.error || res.status);
        return { success: false, error: errorMsg };
      }

      const rawConversations: any[] = Array.isArray(json.data) ? json.data : [];
      if (rawConversations.length === 0) {
        break;
      }

      for (const rawConv of rawConversations) {
        if (conversations.length >= limitConversations) break;

        const convId = String(rawConv.id);
        const updatedTime = rawConv.updated_time || new Date().toISOString();

        // Extract participants
        const participants: Array<{ id: string; username?: string }> = [];
        if (rawConv.participants?.data && Array.isArray(rawConv.participants.data)) {
          for (const p of rawConv.participants.data) {
            participants.push({
              id: String(p.id),
              username: p.username ? String(p.username) : undefined,
            });
          }
        }

        // Extract messages with deduplication by message ID
        const messages: HistoricalMessage[] = [];
        const seenMsgIds = new Set<string>();

        const ingestRawMessages = (rawMsgs: any[]) => {
          for (const m of rawMsgs) {
            if (!m || !m.id || seenMsgIds.has(m.id)) continue;
            seenMsgIds.add(m.id);

            messages.push({
              id: String(m.id),
              created_time: m.created_time || new Date().toISOString(),
              from: m.from ? { id: String(m.from.id), username: m.from.username } : undefined,
              to: m.to?.data ? { data: m.to.data.map((t: any) => ({ id: String(t.id), username: t.username })) } : undefined,
              message: m.message || "",
              attachments: parseRawAttachments(m.attachments?.data),
            });
          }
        };

        if (rawConv.messages?.data && Array.isArray(rawConv.messages.data)) {
          ingestRawMessages(rawConv.messages.data);
        }

        // Nested message pagination
        let nextMsgUrl: string | null = rawConv.messages?.paging?.next || null;
        let msgPages = 0;
        const maxMsgPages = Math.ceil(maxMessagesPerThread / 25);

        while (nextMsgUrl && messages.length < maxMessagesPerThread && msgPages < maxMsgPages) {
          msgPages++;
          try {
            const urlToFetch = nextMsgUrl.includes("access_token")
              ? nextMsgUrl
              : `${nextMsgUrl}${nextMsgUrl.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(cleanToken)}`;

            const msgRes: Response = await fetch(urlToFetch, { signal: AbortSignal.timeout(12000) });
            const msgJson: any = await msgRes.json().catch(() => ({}));

            if (msgRes.ok && Array.isArray(msgJson.data)) {
              ingestRawMessages(msgJson.data);
              nextMsgUrl = msgJson.paging?.next || null;
            } else {
              break;
            }
          } catch (msgErr) {
            console.warn(`[Meta Graph API] Error paginando mensajes en hilo ${convId}:`, msgErr);
            break;
          }
        }

        conversations.push({
          id: convId,
          updated_time: updatedTime,
          participants,
          messages,
        });
      }

      nextConvUrl = json.paging?.next || null;
    }

    return {
      success: true,
      data: conversations,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error inesperado al consultar historial de Instagram";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

