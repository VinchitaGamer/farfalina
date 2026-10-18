# Milestone M2: Changes Documentation

**Date**: 2026-10-06  
**Subagent**: Worker M2 (`worker_followup_m2`)  
**Scope**: Enriquecimiento Persistente de Perfiles: Username, Display Name y Avatar Local

---

## 1. Summary of Modified & Created Files

| File | Action | Description |
|---|---|---|
| `lib/instagram-profile.ts` | Upgraded | Fixed Meta Graph API endpoint fields (`profile_pic` instead of rejected `profile_picture_url`), implemented local disk caching to `/public/uploads/avatars/ig_${customerId}.jpg`, cache reuse TTL (24h), Zod schemas, and strongly typed return objects (`getInstagramUserProfile`, `fetchInstagramProfile`, `fetchFacebookProfile`). |
| `app/api/webhooks/instagram/route.ts` | Updated | Integrated `getInstagramUserProfile`, mapped `@username` and display name into `ChatThread.clientName`, cached local avatar into `ChatThread.profilePicUrl`, and enriched `CRMClient` name and metadata notes with handle and avatar. |
| `scripts/verify-profile-enrichment.ts` | Created | Automated end-to-end verification script testing live Meta Graph API querying for `@acido_juan` (`1304358138230682`), binary avatar download and disk validation, cache reuse, webhook POST ingestion, and SQLite `dev.db` persistence. |

---

## 2. Detailed Technical Changes

### 2.1 `lib/instagram-profile.ts`
1. **Schema & Typings**:
   - Defined `InstagramUserProfileSchema` via Zod with `id`, `name`, `username`, `profilePicUrl`, and backward-compatible `profilePic`.
   - Exported `type InstagramUserProfile = z.infer<typeof InstagramUserProfileSchema>`.
   - Defined `MetaGraphProfileResponseSchema` to safely validate Meta Graph responses.
2. **Fixed Graph API Endpoint**:
   - Endpoint changed to `https://graph.instagram.com/v22.0/{customerId}?fields=id,username,name,profile_pic&access_token={token}`.
   - Removed `profile_picture_url` which Meta rejects with HTTP 400 for customer IDs.
3. **Local Avatar Caching (`cacheAvatarLocally`)**:
   - Created `ensureAvatarsDirectory()` targeting `public/uploads/avatars/`.
   - Persists binary images as `ig_${cleanId}.jpg` (and `fb_${cleanId}.jpg` for Facebook).
   - Reuses existing local file if younger than 24 hours (`AVATAR_CACHE_TTL_MS`), avoiding redundant external CDN calls.
   - Fallback to existing disk file if download fails.
   - Returns public web path `/uploads/avatars/${filename}`.
4. **Exported API**:
   - `getInstagramUserProfile(customerId, accessToken, secondaryToken?)`
   - `fetchInstagramProfile(igsid, accessToken, secondaryToken?)` (alias)
   - `fetchFacebookProfile(psid, pageAccessToken)` (updated to use avatar caching in `/public/uploads/avatars/`)
   - `cacheAvatarLocally` & `ensureAvatarsDirectory`

### 2.2 `app/api/webhooks/instagram/route.ts`
1. **Import**:
   - Added `getInstagramUserProfile` alongside `fetchInstagramProfile`.
2. **Profile Resolution in `processInstagramMessage`**:
   - Calls `getInstagramUserProfile(senderId, token, fbConfig?.facebookPageToken)`.
   - Extracts `instagramUsername`, `instagramDisplayName`, and `profilePicUrl`.
   - Formats `clientName` favoring `@${profile.username}` when available.
3. **`CRMClient` Enrichment**:
   - Builds structured metadata notes: `Origen: INSTAGRAM | Canal: Instagram Direct | IGSID: ${senderId} | Username: @${username} | Nombre: ${name} | Avatar: ${profilePicUrl}`.
   - If client exists, updates `name` if previous name was default placeholder, and appends username & avatar to notes without duplication.
4. **`ChatThread` Enrichment**:
   - Upserts `ChatThread.clientName` to `@${profile.username}`.
   - Sets `ChatThread.profilePicUrl` to local path `/uploads/avatars/ig_${senderId}.jpg`.
   - If thread already existed with default name (`Cliente Instagram...`), replaces with enriched client name.

### 2.3 `scripts/verify-profile-enrichment.ts`
- Automated 5-stage test suite:
  1. Verifies Instagram credentials from `ChannelConfig` in SQLite `prisma/dev.db`.
  2. Queries live Meta Graph API v22.0 for user `1304358138230682` (`@acido_juan`).
  3. Validates avatar binary exists on disk (`public/uploads/avatars/ig_1304358138230682.jpg`, size: 7,098 bytes).
  4. Tests cache hit without duplicate downloads.
  5. Executes webhook `POST` handler end-to-end, asserting that `ChatThread` and `CRMClient` in SQLite `prisma/dev.db` reflect `@acido_juan` and `/uploads/avatars/ig_1304358138230682.jpg`.
