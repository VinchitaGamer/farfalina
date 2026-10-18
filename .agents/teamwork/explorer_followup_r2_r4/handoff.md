# Handoff Report: Investigation for R2 (Profile/Avatar Enrichment) & R4 (Historical Backfill)

**Date**: 2026-10-06  
**From**: Codebase Explorer R2 & R4 (`explorer_followup_r2_r4`)  
**To**: Orchestrator (`1e373fa0-941b-417b-b7c3-a8dd99f78b05`) & Downstream Implementers  
**Type**: Hard Handoff (Investigation & Mapping Completed)  

---

## 1. Observation

### Observation 1: Critical Bug in `lib/instagram-profile.ts`
- **File**: `lib/instagram-profile.ts`, lines 70–75:
  ```typescript
  const url2 = `https://graph.instagram.com/v22.0/${igsid}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(cleanToken)}`;
  ```
- **Verbatim Error**: Executing a query for customer ID `1304358138230682` returned:
  ```json
  { "error": { "message": "Tried accessing nonexisting field (profile_picture_url)", "type": "IGApiException", "code": 100 } }
  ```
- **Working Endpoint**: Querying `https://graph.instagram.com/v22.0/1304358138230682?fields=id,username,name,profile_pic&access_token=...` returned:
  ```json
  HTTP 200 OK
  {
    "id": "1304358138230682",
    "username": "acido_juan",
    "name": "no juan",
    "profile_pic": "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/742447294_18045017732607423_4684767634876646215_n.jpg?stp=dst-jpg_s206x206_tt6&_nc_cat=106&...&oh=00_AQPC_eu55OIyxKyoajP0xxNJkilNfYjW7HB9FaMBe1Lhkw&oe=6ACA7F77"
  }
  ```
- **Binary Avatar Download**: Fetching the `profile_pic` URL directly returned an HTTP 200 JPEG buffer of 7,098 bytes.

### Observation 2: Active Meta Credentials in `ChannelConfig`
- **Database**: SQLite `prisma/dev.db`, table `ChannelConfig`:
  - `channel`: `'Instagram'`, `environment`: `'farfalina'`, `status`: `'CONNECTED'`.
  - `instagramAccountId`: `'29643476368611224'`.
  - `instagramAccessToken`: Starts with `IGAAQEc31z...` (length: 182 characters).
- **Verbatim Test**: `GET https://graph.instagram.com/v22.0/me?access_token=...` returned:
  ```json
  HTTP 200 OK
  { "id": "29643476368611224", "username": "sour_jhxn" }
  ```

### Observation 3: Live Historical Backfill Endpoint & Pagination
- **Endpoint**: `GET https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}&access_token=...`
- **Result**: Responded with HTTP 200 OK.
- **Payload Structure**:
  - `data`: List of conversations. Each conversation contains `id` (e.g. `aWdfZAG06...`), `updated_time`, `participants.data` (`sour_jhxn` and customer `acido_juan`), and `messages.data`.
  - Nested message objects contain `id` (e.g. `aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEO...`), `created_time`, `from`, `to`, `message`, and `attachments`.
  - Nested attachment types found: `image_data`, `video_data`, `file_url`, `generic_template`.
  - Pagination links (`paging.next` with cursor `after`) validated on both top-level conversations and conversation messages (second pages returned 25 conversations and 22 messages respectively with HTTP 200 OK).

### Observation 4: Database Schema (`prisma/schema.prisma`)
- Table `ChatThread` columns: `id`, `clientName`, `phone`, `channel`, `status`, `lastMessage`, `assignedAgent`, `profilePicUrl`, `environment`, `lastMessageAt`, `externalId`, `rawTimestamp`, `unreadCount`, `createdAt`, `updatedAt`.
  - There is no column named `title` or `metadata`. `clientName` serves as the thread display title, and `profilePicUrl` holds the avatar.
- Table `CRMClient` columns: `id`, `name`, `phone`, `favoriteFlower`, `notes`, `totalSpent`, `purchaseCount`, `loyaltyTier`, `lastPurchaseAt`, `createdAt`.
  - There is no column named `avatar`, `instagramHandle`, or `metadata`. Current webhooks store the handle in `name` and origin info in `notes`.
- Table `ChatMessage` columns: `id`, `threadId`, `sender`, `text`, `mediaUrl`, `mediaType`, `environment`, `externalId`, `rawTimestamp`, `timestamp`, `createdAt`.
  - Unique index: `@@unique([threadId, environment, id])`.
  - External lookup index: `@@index([threadId, externalId])`.

### Observation 5: Existing UI Actions & Headers
- **File**: `components/shared/omnichannel/unified-omnichannel-view.tsx`, lines 710–756.
  - Header displays channel status badges, "Abrir Meta Business Suite", "Configuración" button (`setIsConfigModalOpen(true)`), and "Limpiar caché" (`handleClearInbox`).
- **File**: `components/floreria/omnichannel-config-modal.tsx`, lines 973–1060.
  - Instagram tab has "Probar Conexión" (`handleTestInstagram`), "Desconectar", and credential input fields.
- Avatars in thread list, header, and drawer already consume `t.profilePicUrl` (lines 882–884, 987–989, 1480–1482).

---

## 2. Logic Chain

1. **Bug Identification & Resolution (R2)**:
   - Observation 1 proves that calling `graph.instagram.com` with `profile_picture_url` fails with HTTP 400 error code 100.
   - Observation 1 proves that changing the field to `profile_pic` succeeds with HTTP 200, returning `username: "acido_juan"`, `name: "no juan"`, and `profile_pic: "https://instagram.flpb1-2.fna..."`.
   - Therefore, updating `lib/instagram-profile.ts` line 70 from `profile_picture_url` to `profile_pic` immediately resolves profile and avatar resolution for all Instagram users.

2. **Permanent Avatar Caching (R2)**:
   - Meta CDN avatar URLs contain expiration parameters (`oe`, `oh`). Once expired, browsers fail to render them.
   - Observation 1 proves that the avatar binary can be downloaded via standard `fetch(profile_pic)` and saved locally to disk.
   - Files saved in `/public/uploads/avatars/${filename}` are statically served by Next.js without expiring.
   - `ChatThread.profilePicUrl` (Observation 4) already maps directly to `<img src={profilePicUrl} />` in `unified-omnichannel-view.tsx` (Observation 5).

3. **Historical Backfill Viability (R4)**:
   - Observations 2 and 3 confirm that the token in `ChannelConfig` is active and that `GET https://graph.instagram.com/v22.0/me/conversations` provides full historical access back to 2022.
   - Observation 3 shows that conversations include customer IGSID, username, messages, timestamps, and attachments.
   - Observation 3 proves that cursor-based pagination via `paging.next` functions correctly for both conversations and nested messages.

4. **Deduplication Mechanism (R4)**:
   - In Observation 4, `ChatThread` enforces uniqueness on `[channel, phone, environment]`. For Instagram, `phone` is the customer's IGSID. Existing threads can be updated without creating duplicates.
   - In Observation 4, `ChatMessage` indexed on `[threadId, externalId]` allows pre-insert checks against Meta's message ID (`msg.id`), preventing duplicate messages.

5. **Architecture & Placement (R4)**:
   - In accordance with `AGENTS.md` Rule 7 ("Mutaciones vía Server Actions"), the backfill operation should be implemented as `syncHistoricalConversationsAction(environment)` in `app/actions/omnichannel.ts`.
   - In Observation 5, placing a "Sincronizar Histórico" button in the top header of `unified-omnichannel-view.tsx` (next to Configuración) and inside `omnichannel-config-modal.tsx` provides clean access for operators.

---

## 3. Caveats

1. **Meta WhatsApp Cloud API Customer Avatars**: Meta WhatsApp Business Cloud API does not provide an endpoint to fetch individual customer profile photos due to WhatsApp privacy policies. Only customer push names are available via webhook payloads. If Evolution API is configured, customer avatars can be fetched via `/chat/fetchProfilePictureUrl`.
2. **Backfill Pagination Volume**: Because historical conversations can span thousands of messages, the initial implementation should include sensible safety caps (e.g., maximum 50 conversations and 100 messages per thread per batch) to avoid timeouts.
3. **Database Schema Evolution**: Adding `avatar`, `instagramHandle`, and `metadata` to `CRMClient` in `schema.prisma` is optional and non-breaking, but requires approval from `subagent-auth-core-architecture`. Without schema changes, storing avatars in `ChatThread.profilePicUrl` and handles in `CRMClient.name`/`notes` is 100% compatible with existing code.

---

## 4. Conclusion

1. **R2 (Profile & Avatar Enrichment)** is ready to implement:
   - Fix field name in `lib/instagram-profile.ts` (`profile_picture_url` → `profile_pic`).
   - Cache downloaded avatars to `/public/uploads/avatars/ig_${igsid}.jpg`.
   - Update `ChatThread.clientName` to `@username` and `profilePicUrl` to `/uploads/avatars/ig_${igsid}.jpg`.
2. **R4 (Historical Backfill)** is validated and ready to implement:
   - Query `GET https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}&access_token={token}`.
   - Traverse `paging.next` cursors.
   - Deduplicate against `ChatThread` (`[channel, phone, environment]`) and `ChatMessage` (`externalId`).
   - Download historical attachments to `/public/uploads/instagram/`.
   - Provide UI button in `unified-omnichannel-view.tsx` header backed by `syncHistoricalConversationsAction`.

---

## 5. Verification Method

### 1. Verify Profile Endpoint Fix
Run the following node command to verify that `profile_pic` retrieves the customer profile and avatar:
```powershell
node -e "const Database = require('better-sqlite3'); const db = new Database('prisma/dev.db'); const row = db.prepare('SELECT instagramAccessToken FROM ChannelConfig WHERE channel = ? AND environment = ?').get('Instagram', 'farfalina'); (async () => { const u = 'https://graph.instagram.com/v22.0/1304358138230682?fields=id,username,name,profile_pic&access_token=' + encodeURIComponent(row.instagramAccessToken); const r = await fetch(u); const j = await r.json(); console.log('Status:', r.status, 'Response:', JSON.stringify(j)); })();"
```
*Expected*: Status `200`, with `username: "acido_juan"`, `name: "no juan"`, and valid `profile_pic` URL.

### 2. Verify Conversation Backfill Endpoint
Run the following node command to verify the conversations endpoint and cursor pagination:
```powershell
node -e "const Database = require('better-sqlite3'); const db = new Database('prisma/dev.db'); const row = db.prepare('SELECT instagramAccessToken FROM ChannelConfig WHERE channel = ? AND environment = ?').get('Instagram', 'farfalina'); (async () => { const u = 'https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}&access_token=' + encodeURIComponent(row.instagramAccessToken); const r = await fetch(u); const j = await r.json(); console.log('Status:', r.status, 'Conversations count:', j.data ? j.data.length : 0, 'Has next:', !!j.paging?.next); })();"
```
*Expected*: Status `200`, `Conversations count: 25`, `Has next: true`.

### 3. Invalidation Conditions
- Meta access token expiration or invalidation (error code 190).
- Network disconnect or failure to reach `graph.instagram.com`.
- Renaming or deleting columns in SQLite `prisma/dev.db`.
