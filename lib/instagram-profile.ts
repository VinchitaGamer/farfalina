import path from "path";
import fs from "fs";
import { z } from "zod";

/**
 * Zod schema defining the standardized Instagram user profile.
 * Source of truth for profile enrichment across omnichannel modules.
 */
export const InstagramUserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  profilePicUrl: z.string().nullable(),
  profilePic: z.string().nullable().optional(), // Backward compatibility alias
});

export type InstagramUserProfile = z.infer<typeof InstagramUserProfileSchema>;

/**
 * Raw Meta Graph API response schema for user profile endpoints.
 */
const MetaGraphProfileResponseSchema = z.object({
  id: z.string().optional(),
  username: z.string().optional(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  profile_pic: z.string().optional().nullable(),
  error: z.unknown().optional(),
}).passthrough();

const AVATARS_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const AVATAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Ensures that the public avatars storage directory exists.
 */
export function ensureAvatarsDirectory(): void {
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }
}

/**
 * Downloads a remote avatar image and saves it locally in /public/uploads/avatars/.
 * Returns the public web path /uploads/avatars/{filename}.
 * Reuses existing local file if it exists and is recent (< 24 hours).
 *
 * @param remoteUrl - URL returned by Meta CDN (contains expiring signature params)
 * @param prefix - Prefix for local filename (e.g. "ig" or "fb")
 * @param id - Unique contact identifier (IGSID or PSID)
 */
export async function cacheAvatarLocally(
  remoteUrl: string | null | undefined,
  prefix: string,
  id: string
): Promise<string | null> {
  if (!remoteUrl || !remoteUrl.startsWith("http")) {
    return remoteUrl || null;
  }

  ensureAvatarsDirectory();
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${prefix}_${cleanId}.jpg`;
  const localFilePath = path.join(AVATARS_DIR, filename);
  const publicWebPath = `/uploads/avatars/${filename}`;

  // Reuse existing local file if recent and non-empty
  if (fs.existsSync(localFilePath)) {
    try {
      const stats = fs.statSync(localFilePath);
      if (stats.size > 0 && Date.now() - stats.mtimeMs < AVATAR_CACHE_TTL_MS) {
        return publicWebPath;
      }
    } catch {
      // Proceed to download if stat check fails
    }
  }

  try {
    const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength > 0) {
        fs.writeFileSync(localFilePath, Buffer.from(arrayBuf));
        return publicWebPath;
      }
    } else {
      console.warn(`[AvatarCache] Falló descarga de avatar para ${id} (${res.status} ${res.statusText})`);
    }
  } catch (err) {
    console.warn(`[AvatarCache] Error descargando avatar remoto para ${id}:`, err);
  }

  // Fallback to local copy if one exists despite download failure
  if (fs.existsSync(localFilePath)) {
    return publicWebPath;
  }

  return remoteUrl;
}

/**
 * Retrieves an Instagram user's profile from Meta Graph API v22.0.
 *
 * Queries https://graph.instagram.com/v22.0/{customerId}?fields=id,username,name,profile_pic&access_token={token}
 * (DO NOT use profile_picture_url as Meta rejects it with HTTP 400 for customer IDs).
 *
 * Downloads and caches the avatar image to /public/uploads/avatars/ig_{customerId}.jpg.
 * Returns strongly typed InstagramUserProfile.
 *
 * @param customerId - Customer IGSID (e.g. "1304358138230682")
 * @param accessToken - Active Meta access token
 * @param secondaryToken - Optional fallback token (e.g. Facebook Page Token)
 */
export async function getInstagramUserProfile(
  customerId: string,
  accessToken: string,
  secondaryToken?: string | null
): Promise<InstagramUserProfile | null> {
  if (!customerId || customerId.trim().length === 0) return null;

  const cleanCustomerId = customerId.trim();
  const tokens = [accessToken, secondaryToken].filter((t): t is string => !!t && t.trim().length > 5);
  if (tokens.length === 0) return null;

  for (const rawToken of tokens) {
    const cleanToken = rawToken.trim().replace(/^["']|["']$/g, "");

    // Strategy 1: graph.instagram.com (Instagram Login for Business)
    // Note: Requesting profile_pic works with HTTP 200, while profile_picture_url causes HTTP 400.
    try {
      const urlInstagram = `https://graph.instagram.com/v22.0/${encodeURIComponent(cleanCustomerId)}?fields=id,username,name,profile_pic&access_token=${encodeURIComponent(cleanToken)}`;
      const res = await fetch(urlInstagram, { method: "GET", signal: AbortSignal.timeout(6000) });
      const rawData = await res.json();
      const parseResult = MetaGraphProfileResponseSchema.safeParse(rawData);

      if (parseResult.success) {
        const data = parseResult.data;
        if (!data.error && (data.id || data.username || data.name || data.profile_pic)) {
          const cleanUsername = data.username ? data.username.replace(/^@/, "").trim() : "";
          const displayName = data.name?.trim() || (cleanUsername ? `@${cleanUsername}` : cleanCustomerId);

          let cachedAvatarUrl: string | null = null;
          if (data.profile_pic) {
            cachedAvatarUrl = await cacheAvatarLocally(data.profile_pic, "ig", cleanCustomerId);
          }

          return {
            id: data.id || cleanCustomerId,
            name: displayName,
            username: cleanUsername,
            profilePicUrl: cachedAvatarUrl,
            profilePic: cachedAvatarUrl,
          };
        }
      }
    } catch (igErr) {
      console.warn(`[Instagram Profile] Error en graph.instagram.com para IGSID ${cleanCustomerId}:`, igErr);
    }

    // Strategy 2: graph.facebook.com (Page-scoped Graph API fallback)
    try {
      const urlFacebook = `https://graph.facebook.com/v22.0/${encodeURIComponent(cleanCustomerId)}?fields=name,username,profile_pic,first_name,last_name&access_token=${encodeURIComponent(cleanToken)}`;
      const resFb = await fetch(urlFacebook, { method: "GET", signal: AbortSignal.timeout(6000) });
      const rawDataFb = await resFb.json();
      const parseResultFb = MetaGraphProfileResponseSchema.safeParse(rawDataFb);

      if (parseResultFb.success) {
        const dataFb = parseResultFb.data;
        if (!dataFb.error && (dataFb.id || dataFb.username || dataFb.name || dataFb.first_name || dataFb.profile_pic)) {
          const cleanUsername = dataFb.username ? dataFb.username.replace(/^@/, "").trim() : "";
          const fullName = dataFb.name?.trim() || [dataFb.first_name, dataFb.last_name].filter(Boolean).join(" ").trim();
          const displayName = cleanUsername ? `@${cleanUsername}` : (fullName || cleanCustomerId);

          let cachedAvatarUrl: string | null = null;
          if (dataFb.profile_pic) {
            cachedAvatarUrl = await cacheAvatarLocally(dataFb.profile_pic, "ig", cleanCustomerId);
          }

          return {
            id: dataFb.id || cleanCustomerId,
            name: displayName,
            username: cleanUsername,
            profilePicUrl: cachedAvatarUrl,
            profilePic: cachedAvatarUrl,
          };
        }
      }
    } catch (fbErr) {
      console.warn(`[Instagram Profile] Fallback graph.facebook.com falló para IGSID ${cleanCustomerId}:`, fbErr);
    }
  }

  return null;
}

/**
 * Backward compatibility alias for fetchInstagramProfile.
 */
export async function fetchInstagramProfile(
  igsid: string,
  accessToken: string,
  secondaryToken?: string | null
): Promise<InstagramUserProfile | null> {
  return getInstagramUserProfile(igsid, accessToken, secondaryToken);
}

/**
 * Fetch the Facebook user's real profile (name, first_name, last_name, profile_pic)
 * via Meta Graph API using their PSID (Page Scoped ID).
 * Caches avatar image locally in /public/uploads/avatars/fb_{psid}.jpg.
 *
 * @param psid - Facebook Page Scoped User ID
 * @param pageAccessToken - Facebook Page Access Token
 */
export async function fetchFacebookProfile(
  psid: string,
  pageAccessToken: string
): Promise<{ name: string; profilePic: string | null; profilePicUrl: string | null } | null> {
  if (!psid || !pageAccessToken) return null;
  const cleanToken = pageAccessToken.trim().replace(/^["']|["']$/g, "");
  const cleanPsid = psid.trim();

  try {
    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(cleanPsid)}?fields=first_name,last_name,name,profile_pic&access_token=${encodeURIComponent(cleanToken)}`;
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(6000) });
    const data = await res.json();

    if (!data.error && (data.name || data.first_name || data.profile_pic)) {
      const fullName = data.name?.trim() || [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
      let cachedAvatarUrl: string | null = null;
      if (data.profile_pic) {
        cachedAvatarUrl = await cacheAvatarLocally(data.profile_pic, "fb", cleanPsid);
      }

      return {
        name: fullName || `Usuario Facebook (${cleanPsid.slice(-4)})`,
        profilePic: cachedAvatarUrl,
        profilePicUrl: cachedAvatarUrl,
      };
    }
  } catch (err) {
    console.warn(`[Facebook Profile] Error al obtener perfil para PSID ${cleanPsid}:`, err);
  }

  return null;
}