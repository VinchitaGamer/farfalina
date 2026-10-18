# Technical Analysis Report: R2 (Profile/Avatar Enrichment) & R4 (Historical Backfill)

**Date**: 2026-10-06  
**Investigator**: Codebase Explorer R2 & R4  
**Target Environment**: Next.js 14 App Router, SQLite (`prisma/dev.db`), Meta Graph API v22.0  
**Status**: Completed & Verified live against Meta Graph API  

---

## Executive Summary

This investigation covers two core requirements of the omnichannel suite follow-up:
1. **R2 — Persistent Profile & Avatar Enrichment**: Enabling real usernames (`@username`), full display names, and local disk-caching of avatars in `/public/uploads/avatars/` to permanently eliminate broken links caused by expiring Meta CDN security tokens (`oe`, `oh`).
2. **R4 — Retroactive Historical Backfill**: Integrating Meta Graph API conversation endpoints to import past customer threads and historical messages directly into SQLite (`prisma/dev.db`), featuring robust deduplication via `externalId` (Meta `mid`), multi-page cursor pagination, and outbound/inbound role separation.

### Critical Live Discoveries
- **Bug identified in `lib/instagram-profile.ts`**: When querying customer profiles on `graph.instagram.com/v22.0/{customerId}`, requesting the field `profile_picture_url` triggers an HTTP 400 crash (`IGApiException: Tried accessing nonexisting field (profile_picture_url)`). The valid field name on this endpoint is `profile_pic`. When queried as `fields=id,username,name,profile_pic`, the endpoint succeeds with **HTTP 200 OK**, returning the user's `@username`, real name, and full CDN avatar image URL.
- **Live Endpoint Validation**: Using the active token in `ChannelConfig` (`IGAA...`, 182 chars, Account ID `29643476368611224`), the endpoint `GET https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}` responded **HTTP 200 OK**, returning complete historical threads dating back to 2022. Both conversation-level and message-level pagination (`paging.next` and cursor `after`) and attachment payloads (`image_data`, `video_data`, `file_url`) were validated live.

---

## 1. Requirement R2: Enriquecimiento Persistente de Perfiles (Username, Display Name y Avatar)

### 1.1 Current Architecture & Flow Analysis

#### 1. Webhook Ingestion (`app/api/webhooks/instagram/route.ts`)
- Inbound messages arrive via `POST /api/webhooks/instagram` (lines 142–318).
- The payload contains `entry[].messaging[]` with `sender.id` (Customer IGSID, e.g. `1304358138230682`) and `recipient.id` (Instagram Account ID, e.g. `29643476368611224`).
- Inside `processInstagramMessage` (lines 330–527):
  - Line 360: Initializes default name: `let clientName = 'Cliente Instagram (' + senderId.slice(-4) + ')'`.
  - Line 378: Calls `fetchInstagramProfile(senderId, token, fbPageToken)`.
  - If a profile is returned:
    - Sets `clientName = profile.username ? '@' + profile.username : profile.name`.
    - Sets `profilePicUrl = profile.profilePic`.
  - Lines 390–426: Creates or updates `CRMClient` in SQLite.
  - Lines 431–526: Creates or updates `ChatThread` in SQLite, assigning `clientName` and `profilePicUrl`.

#### 2. Profile Fetcher (`lib/instagram-profile.ts`)
Currently implements two strategies:
- **Strategy 1 (lines 43–66)**: Queries `https://graph.facebook.com/v22.0/${igsid}?fields=name,username,profile_pic,first_name,last_name&access_token=...`.
  - *Observation*: Fails with HTTP 400 / Code 190 (`Invalid OAuth access token`) because the token configured in `ChannelConfig` is an Instagram User Token (`IGAA...`), which is not accepted by `graph.facebook.com`.
- **Strategy 2 (lines 69–92)**: Queries `https://graph.instagram.com/v22.0/${igsid}?fields=id,username,name,profile_picture_url&access_token=...`.
  - *Observation*: Fails with HTTP 400 (`Tried accessing nonexisting field (profile_picture_url)`).
  - *Root Cause*: Requesting `profile_picture_url` invalidates the entire query.

### 1.2 Exact Fields Returned by Meta Graph API for Instagram Users

Live verification using customer ID `1304358138230682` against `graph.instagram.com/v22.0/` demonstrated the following behavior per field:

| Field | HTTP Status | Response Value | Evaluation |
|---|---|---|---|
| `id` | **200 OK** | `"1304358138230682"` | Customer IGSID |
| `username` | **200 OK** | `"acido_juan"` | Real Instagram handle (without `@`) |
| `name` | **200 OK** | `"no juan"` | Full display name on Instagram profile |
| `profile_pic` | **200 OK** | `"https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/..."` | Full CDN image URL |
| `profile_picture_url` | **400 Bad Request** | `Tried accessing nonexisting field (profile_picture_url)` | ❌ Must NOT be requested on this endpoint |
| `biography` | **400 Bad Request** | `Tried accessing nonexisting field (biography)` | Restricted |
| `website` | **400 Bad Request** | `Tried accessing nonexisting field (website)` | Restricted |

**Correct Graph Query**:
```
GET https://graph.instagram.com/v22.0/{igsid}?fields=id,username,name,profile_pic&access_token={token}
```
Response:
```json
{
  "id": "1304358138230682",
  "username": "acido_juan",
  "name": "no juan",
  "profile_pic": "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/742447294_18045017732607423_4684767634876646215_n.jpg?stp=dst-jpg_s206x206_tt6&_nc_cat=106&...&oh=00_AQPC_eu55OIyxKyoajP0xxNJkilNfYjW7HB9FaMBe1Lhkw&oe=6ACA7F77"
}
```

### 1.3 WhatsApp Profile Resolution

1. **Meta WhatsApp Cloud API (`app/api/webhooks/whatsapp/route.ts`)**:
   - Inbound webhook payloads include `entry[].changes[].value.contacts[]`.
   - Each item provides `{ profile: { name: "Avril" }, wa_id: "591..." }`.
   - Meta WhatsApp Cloud API webhooks provide the customer's push name directly.
   - *Avatar limitation in Meta Cloud API*: Meta's WhatsApp Business Cloud API does not expose an endpoint to retrieve individual customer profile photos due to end-user WhatsApp privacy restrictions.
2. **Evolution API / WhatsApp Web Socket (`lib/evolution-api.ts`)**:
   - Webhook provides `data.pushName` and `data.key.remoteJid`.
   - Evolution API supports fetching contact profile pictures via:
     `GET {EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/{instance}?number={cleanPhone}`.
   - When configured, this returns a public URL or Base64 avatar that can be downloaded to disk.

### 1.4 Persistent Local Caching in `/public/uploads/avatars/`

#### Problem
Meta CDN URLs for Instagram profile pictures contain ephemeral signature parameters:
- `oe=6ACA7F77`: Hex timestamp indicating when the URL expires (usually within 24–72 hours).
- `oh=00_AQ...`: HMAC security signature bound to IP and session.
Once `oe` expires, any browser attempting to render `<img src={profilePicUrl} />` receives HTTP 403 Forbidden, resulting in broken image icons across the omnichannel UI.

#### Solution
1. Ensure the directory exists:
   ```ts
   const AVATARS_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
   if (!fs.existsSync(AVATARS_DIR)) {
     fs.mkdirSync(AVATARS_DIR, { recursive: true });
   }
   ```
2. Download the binary via native `fetch(remoteUrl)` with `AbortSignal.timeout(8000)`.
   *Live test result*: The downloaded binary is a valid JPEG of 7,098 bytes.
3. Save the file with a deterministic naming format:
   ```ts
   const filename = `${prefix}_${cleanId}.jpg`; // e.g. ig_1304358138230682.jpg
   const localPath = path.join(AVATARS_DIR, filename);
   fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
   ```
4. Return the local web path: `/uploads/avatars/${filename}`.
   Because files in `/public/` are served statically by Next.js, this URL never expires, loads instantly from localhost/tunnel, and works offline.

### 1.5 Database Schema Mapping (`ChatThread` & `CRMClient`)

Inspected `prisma/schema.prisma` and SQLite table metadata (`PRAGMA table_info`):

#### 1. `ChatThread`
- Columns: `id`, `clientName`, `phone`, `channel`, `status`, `lastMessage`, `assignedAgent`, `profilePicUrl`, `environment`, `lastMessageAt`, `externalId`, `rawTimestamp`, `unreadCount`, `createdAt`, `updatedAt`.
- **Field Roles**:
  - `clientName`: Stores `@username` or real name (e.g. `@acido_juan` or `no juan`).
  - `phone`: Stores the customer's IGSID (e.g. `1304358138230682`) for Instagram.
  - `profilePicUrl`: Stores the local avatar path `/uploads/avatars/ig_1304358138230682.jpg`.
  - `externalId`: Stores the Meta mailbox / conversation ID (`aWdfZAG06...`).
  - *Note*: There is no column named `title` or `metadata`. `clientName` serves as the thread title.

#### 2. `CRMClient`
- Columns: `id`, `name`, `phone`, `favoriteFlower`, `notes`, `totalSpent`, `purchaseCount`, `loyaltyTier`, `lastPurchaseAt`, `createdAt`.
- **Field Roles**:
  - `name`: Stores `@username` or full display name.
  - `phone`: Stores the IGSID (unique constraint `phone String @unique`).
  - `notes`: Stores customer origin and channel notes (e.g. `Origen: INSTAGRAM | Canal: Instagram Direct | IGSID: 1304358138230682`).
- **Schema Evolution Options**:
  - **Option A (Non-breaking additive migration approved by core architecture)**:
    Add optional columns to `schema.prisma`:
    ```prisma
    model CRMClient {
      ...
      avatar          String?   // URL o ruta local a foto de perfil
      instagramHandle String?   // Username de Instagram sin @
      metadata        String?   // JSON serializado con datos enriquecidos
    }
    model ChatThread {
      ...
      metadata        String?   // JSON serializado
    }
    ```
  - **Option B (Zero-migration / immediate compatibility)**:
    Store the local avatar in `ChatThread.profilePicUrl` (already in schema), keep `@username` in `CRMClient.name`, and serialize `{ avatar, instagramHandle }` into structured JSON within `CRMClient.notes`.

---

## 2. Requirement R4: Sincronización Retroactiva de Conversaciones Previas (Backfill de Historial)

### 2.1 Meta Graph API Conversation History Endpoint

#### Verified Endpoint
```
GET https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}&access_token={token}
```
*Note*: `graph.instagram.com` must be used because the token starts with `IGAA`. `graph.facebook.com` will reject `IGAA` tokens with error 190.

#### Verified Live Response Structure
```json
{
  "data": [
    {
      "id": "aWdfZAG06MzQwMjgyMzY2ODQxNzEwMzAxMjQ0MjU5NzEzNzM0NjE1MDc2Mjgy",
      "updated_time": "2026-10-06T08:31:01+0000",
      "participants": {
        "data": [
          { "username": "sour_jhxn", "id": "17841406898817900" },
          { "username": "acido_juan", "id": "1304358138230682" }
        ]
      },
      "messages": {
        "data": [
          {
            "id": "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIwNTM0OTA2ODY1ODEwMDA1ODA5OTAyODA2NjMwNAZDZD",
            "created_time": "2026-10-06T08:35:51+0000",
            "from": {
              "username": "sour_jhxn",
              "id": "17841406898817900"
            },
            "to": {
              "data": [
                { "username": "acido_juan", "id": "1304358138230682" }
              ]
            },
            "message": "",
            "attachments": {
              "data": [
                {
                  "image_data": {
                    "width": 720,
                    "height": 1280,
                    "url": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=...",
                    "preview_url": "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=..."
                  }
                }
              ]
            }
          }
        ],
        "paging": {
          "cursors": { "after": "ZAXlKamRYSn..." },
          "next": "https://graph.instagram.com/v26.0/{conversation_id}/messages?..."
        }
      }
    }
  ],
  "paging": {
    "cursors": { "after": "ZAXlKMGFX..." },
    "next": "https://graph.instagram.com/v26.0/17841406898817900/conversations?..."
  }
}
```

### 2.2 Credentials in `ChannelConfig`

From SQLite `prisma/dev.db`:
- **Channel**: `Instagram`
- **Environment**: `farfalina`
- **Status**: `CONNECTED`
- **Instagram Account ID**: `29643476368611224`
- **Instagram Access Token**: `IGAAQEc31z...` (182 characters)
- **Token Type**: Instagram User Token / Instagram Login for Business User Token.
- **Verification Result**: Verified live with `GET /me` (returns account ID `29643476368611224`, username `sour_jhxn`).

### 2.3 Pagination Mechanism

Meta Graph API uses cursor-based pagination at two nested levels:
1. **Conversations level**:
   - `res.data`: Array of up to 25 conversations.
   - `res.paging.next`: Full URL containing the query parameters and cursor `&after={cursor}`.
   - If `res.paging.next` exists, fetch the next URL to get conversations 26–50, and so on.
   - *Live Test*: Successfully fetched second page of conversations (25 conversations returned).
2. **Messages level (within each conversation)**:
   - `conv.messages.data`: First 25 messages of the conversation.
   - `conv.messages.paging.next`: Full URL to fetch the next batch of historical messages for that specific conversation.
   - *Live Test*: Followed `firstConv.messages.paging.next` and received 22 additional historical messages with HTTP 200 OK.
   - **Recommendation**: To avoid timeout during initial sync, set a sensible limit per thread (e.g. up to 100 messages / 4 pages per thread) or allow full historical sync in batches.

### 2.4 Attachment Types Found in Historical Messages

Inspection across historical messages identified 4 distinct attachment keys:
1. `image_data`: Contains `url`, `preview_url`, `width`, `height`. -> Map to `mediaType: "image"`.
2. `video_data`: Contains `url`. -> Map to `mediaType: "video"`.
3. `file_url`: String URL. -> Map to `mediaType: "document"` or `"audio"`.
4. `generic_template`: Rich card payload. -> Map to `mediaType: "document"`.

All media URLs can be downloaded and permanently cached via `downloadAndCacheMetaMedia` from `lib/meta-graph-api.ts`.

### 2.5 Deduplication Strategy

To guarantee that running the backfill does not duplicate records in `prisma/dev.db`:

#### Thread Deduplication
1. Check `ChatThread` by compound tenant key:
   ```ts
   const thread = await prisma.chatThread.findUnique({
     where: {
       chatthread_tenant_unique: {
         channel: "Instagram",
         phone: customerIgsid,
         environment: "farfalina",
       },
     },
   });
   ```
2. If the thread exists:
   - Link messages to this existing thread.
   - Update `externalId = conv.id` if not set.
   - Update `clientName` with `@username` if the current name is default (`Cliente Instagram...`).
   - Update `profilePicUrl` with local avatar if missing.
3. If the thread does not exist:
   - Create new `ChatThread` record.

#### Message Deduplication
1. The message ID returned by Meta (`msg.id`, e.g. `aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEO...`) is unique across the Instagram platform.
2. Query before insert:
   ```ts
   const existingMsg = await prisma.chatMessage.findFirst({
     where: {
       OR: [
         { externalId: msg.id },
         {
           threadId: thread.id,
           sender: senderRole,
           text: msg.message || "",
           createdAt: msgDate,
         },
       ],
     },
   });
   if (existingMsg) {
     // Skip insert, already in database
     continue;
   }
   ```
3. When creating `ChatMessage`:
   - `externalId: msg.id`
   - `sender`: `msg.from.id === businessAccountId ? "agent" : "customer"`
   - `timestamp`: `new Date(msg.created_time)`
   - `createdAt`: `new Date(msg.created_time)` (preserves historical timeline order)
   - `mediaUrl`: Cached local path (if attachment downloaded)
   - `mediaType`: Computed media type

### 2.6 UI Trigger & Architecture Recommendation

#### Server Action (`app/actions/omnichannel.ts`)
Conforming to Rule 7 of `AGENTS.md` ("Mutaciones vía Server Actions") and the bilateral JSON response contract `{ success, data, error, code }`:
```typescript
export async function syncHistoricalConversationsAction(
  environment: string = "farfalina",
  options?: { maxConversations?: number; maxPagesPerThread?: number }
): Promise<ActionResponse<{
  syncedThreads: number;
  syncedMessages: number;
  enrichedProfiles: number;
  skippedDuplicates: number;
}>>
```

#### UI Placements
1. **Primary Quick Action (Top Header of `UnifiedOmnichannelView`)**:
   - Location: `components/shared/omnichannel/unified-omnichannel-view.tsx` lines 745–756, right between `Configuración` and `Limpiar caché`.
   - UI Element:
     ```tsx
     <button
       onClick={handleSyncHistory}
       disabled={isSyncing}
       className="px-3.5 py-2 bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
       title="Sincronizar conversaciones y mensajes históricos de Instagram Direct"
     >
       <RefreshCw className={`h-3.5 w-3.5 text-pink-600 ${isSyncing ? "animate-spin" : ""}`} />
       <span className="hidden sm:inline">Sincronizar Histórico</span>
     </button>
     ```
   - Interaction: Displays a loading spinner while executing and triggers a toast notification upon completion:
     *"Sincronización completada: X conversaciones y Y mensajes importados"*.

2. **Secondary Channel Settings Action (`OmnichannelConfigModal`)**:
   - Location: `components/floreria/omnichannel-config-modal.tsx` lines 994–1016 (Instagram Tab, next to "Probar Conexión").
   - Allows syncing directly from the Instagram configuration panel.

---

## 3. Concrete Implementation Blueprint (For Implementer Subagents)

### 3.1 Fix for `lib/instagram-profile.ts`
Replace the broken strategy in `fetchInstagramProfile`:

```typescript
// Fix Strategy 2 in lib/instagram-profile.ts:
// Change fields from:
// ?fields=id,username,name,profile_picture_url
// To:
// ?fields=id,username,name,profile_pic

try {
  const url2 = `https://graph.instagram.com/v22.0/${igsid}?fields=id,username,name,profile_pic&access_token=${encodeURIComponent(cleanToken)}`;
  const res2 = await fetch(url2, { method: "GET", signal: AbortSignal.timeout(6000) });
  const data2 = await res2.json();

  if (!data2.error && (data2.username || data2.name || data2.profile_pic)) {
    const username = data2.username ? data2.username.replace(/^@/, "").trim() : "";
    const displayName = username ? `@${username}` : (data2.name || `Instagram (${igsid.slice(-4)})`);

    let localPicUrl: string | null = data2.profile_pic || null;
    if (localPicUrl) {
      localPicUrl = await cacheProfilePicLocally(localPicUrl, "ig", igsid);
    }

    return {
      name: displayName,
      username: username,
      profilePic: localPicUrl,
    };
  }
} catch (err) {
  // Strategy failure handling
}
```

And in `cacheProfilePicLocally`:
Change upload directory from `public/uploads/instagram` to `public/uploads/avatars`:
```typescript
const UPLOADS_AVATARS_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
if (!fs.existsSync(UPLOADS_AVATARS_DIR)) {
  fs.mkdirSync(UPLOADS_AVATARS_DIR, { recursive: true });
}
...
return `/uploads/avatars/${filename}`;
```

### 3.2 Backfill Logic in `app/actions/omnichannel.ts`
Implement `syncHistoricalConversationsAction`:
1. Load `ChannelConfig` for Instagram (`farfalina`).
2. Query `GET https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}&access_token=${token}`.
3. For each conversation:
   - Identify customer participant (participant ID !== business ID).
   - Enrich customer profile using fixed `fetchInstagramProfile`.
   - Upsert `ChatThread` and `CRMClient`.
   - Iterate through `messages.data` (and `messages.paging.next` if paginated).
   - Deduplicate against `ChatMessage.externalId`.
   - Cache attachments if present.
   - Insert new `ChatMessage` records.
4. Update thread `lastMessage` and `lastMessageAt`.
5. Return standardized result `{ success: true, data: { ... }, code: "SUCCESS" }`.

---

## 4. Risk Assessment & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Meta Rate Limiting on Graph API | Temporary HTTP 429 during large sync | Low | Implement batching, page limits (e.g. 50 conversations per sync), and 200ms delays between pages. |
| Duplicate messages on re-sync | Cluttered chat UI | Low | Deduplication strictly keyed by `externalId` (Meta `mid`) and exact timestamp match. |
| Expired Meta CDN URLs for historical media | Broken image links | Medium | Immediately download and cache media to `/public/uploads/instagram/` during backfill. |
| Breaking changes in `prisma/schema.prisma` | Database migration failure | Low | Only use existing schema columns (`profilePicUrl`, `clientName`, `externalId`, `notes`) or strictly additive non-breaking optional columns (`String?`). |
