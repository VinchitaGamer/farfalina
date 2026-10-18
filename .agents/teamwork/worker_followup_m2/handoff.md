# Handoff Report: Milestone M2 — Enriquecimiento Persistente de Perfiles

**Date**: 2026-10-06  
**From**: Worker M2 (`worker_followup_m2`)  
**To**: Orchestrator (`1e373fa0-941b-417b-b7c3-a8dd99f78b05`)  
**Type**: Hard Handoff  

---

## 1. Observation

1. **Meta Graph Query for Customer IGSID**:
   - Query: `GET https://graph.instagram.com/v22.0/1304358138230682?fields=id,username,name,profile_pic&access_token=...`
   - Result: HTTP Status 200 OK.
   - Verbatim response:
     ```json
     {
       "id": "1304358138230682",
       "username": "acido_juan",
       "name": "no juan",
       "profile_pic": "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/742447294_18045017732607423_4684767634876646215_n.jpg?stp=dst-jpg_s206x206_tt6&_nc_cat=106&...&oh=00_AQONa5fVmwtTPtwrQIK5LNAyy4nQ1A_FaKyW8OUAYsqEJw&oe=6ACA7F77"
     }
     ```
   - Previous query with `profile_picture_url` was verified to fail with:
     `{"error":{"message":"Tried accessing nonexisting field (profile_picture_url)","type":"IGApiException","code":100}}`.

2. **Local Avatar Storage on Disk**:
   - Target directory: `public/uploads/avatars/`.
   - File written: `C:\Users\Lenovo\Desktop\floreria\public\uploads\avatars\ig_1304358138230682.jpg`.
   - `fs.statSync` confirmed:
     ```
     size: 7098 bytes
     mtimeMs: 1791279192817
     ```
   - Binary format: valid JPEG image directly served via Next.js static asset handler at `/uploads/avatars/ig_1304358138230682.jpg`.

3. **Webhook Processing & Database Persistence**:
   - Webhook `POST /api/webhooks/instagram?env=farfalina` executed via automated test script.
   - Result:
     ```json
     {"success": true, "data": {"received": true}, "code": "SUCCESS"}
     ```
   - `ChatThread` record in SQLite (`prisma/dev.db`):
     ```json
     {
       "id": "cmuwdn1680001hwuhmp9xyhr5",
       "clientName": "@acido_juan",
       "phone": "1304358138230682",
       "profilePicUrl": "/uploads/avatars/ig_1304358138230682.jpg"
     }
     ```
   - `CRMClient` record in SQLite (`prisma/dev.db`):
     ```json
     {
       "id": "cmuwdn13z0000hwuh9sg3f5xz",
       "name": "@acido_juan",
       "phone": "1304358138230682",
       "notes": "Origen: INSTAGRAM | Canal: Instagram Direct | IGSID: 1304358138230682 | Username: @acido_juan | Avatar: /uploads/avatars/ig_1304358138230682.jpg"
     }
     ```

4. **Automated Verification Commands**:
   - Command: `npx tsx scripts/verify-profile-enrichment.ts` -> Exited with code 0 (All 5 stages passed).
   - Command: `npx tsc --noEmit` -> Exited with code 0 (Clean compilation, zero TypeScript errors).

---

## 2. Logic Chain

1. **Resolution of Expiring CDN URLs (R2)**:
   - Based on Observation 1, Meta CDN URLs for user avatars include time-limited signature parameters (`oe`, `oh`).
   - Based on Observation 2, downloading the image binary via native fetch and saving it to `public/uploads/avatars/ig_${customerId}.jpg` ensures the avatar is statically served by Next.js at `/uploads/avatars/ig_${customerId}.jpg`.
   - Reusing existing local files younger than 24 hours eliminates repetitive downloads while maintaining fresh profile avatars.

2. **Resolution of Field Mismatch in `lib/instagram-profile.ts`**:
   - Based on Observation 1, Meta Graph API v22.0 rejects `profile_picture_url` with HTTP 400 for customer IDs, but accepts `profile_pic` with HTTP 200.
   - Upgrading `lib/instagram-profile.ts` to request `fields=id,username,name,profile_pic` guarantees successful retrieval of the user handle (`acido_juan`), full name (`no juan`), and avatar image.

3. **Database Consistency & UI Integration**:
   - Based on Observation 3, when incoming messages arrive, `processInstagramMessage` calls `getInstagramUserProfile`.
   - The thread in `ChatThread` receives `clientName = "@acido_juan"` and `profilePicUrl = "/uploads/avatars/ig_1304358138230682.jpg"`.
   - The customer profile in `CRMClient` stores `@acido_juan` in `name` and records origin, handle, and avatar URL in `notes`.
   - Because `unified-omnichannel-view.tsx` consumes `thread.profilePicUrl` directly, the user avatar displays immediately in the thread list, header, and customer drawer without expiring.

---

## 3. Caveats

1. **WhatsApp Cloud API Contact Avatars**:
   - Meta WhatsApp Business Cloud API does not provide an endpoint to download individual customer profile pictures due to WhatsApp user privacy policies (only push names are provided in webhook contacts payload). Contact photos can only be resolved if Evolution API is configured.
2. **Avatar Cache Invalidation**:
   - The local avatar cache TTL is configured to 24 hours (`AVATAR_CACHE_TTL_MS`). If an Instagram user changes their avatar picture, the change will be reflected on the next incoming message received after the 24-hour window expires.

---

## 4. Conclusion

Milestone M2 is complete and verified:
- `lib/instagram-profile.ts` has been upgraded with the verified Meta Graph API endpoint, robust Zod validation, local disk caching in `/public/uploads/avatars/`, and 24-hour cache reuse.
- `app/api/webhooks/instagram/route.ts` enriches `ChatThread` (`clientName: "@acido_juan"`, `profilePicUrl: "/uploads/avatars/ig_..."`) and `CRMClient` in SQLite `dev.db`.
- The automated verification script `scripts/verify-profile-enrichment.ts` and `npx tsc --noEmit` pass with 100% success.

---

## 5. Verification Method

To independently verify the implementation:

1. **Run Automated Test Script**:
   ```powershell
   npx tsx scripts/verify-profile-enrichment.ts
   ```
   *Expected result*: Exits with code 0, confirms live Meta Graph API query, validates avatar file size (7,098 bytes), cache reuse, and SQLite persistence in `ChatThread` and `CRMClient`.

2. **Run TypeScript Strict Compiler**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected result*: Exits with code 0 with zero errors.

3. **Inspect SQLite Database**:
   ```powershell
   node -e "const Database = require('better-sqlite3'); const db = new Database('prisma/dev.db'); console.log(db.prepare('SELECT clientName, profilePicUrl FROM ChatThread WHERE phone = ?').get('1304358138230682'));"
   ```
   *Expected result*:
   `{ clientName: '@acido_juan', profilePicUrl: '/uploads/avatars/ig_1304358138230682.jpg' }`

4. **Verify Physical File on Disk**:
   ```powershell
   node -e "const fs = require('fs'); console.log(fs.existsSync('public/uploads/avatars/ig_1304358138230682.jpg'), fs.statSync('public/uploads/avatars/ig_1304358138230682.jpg').size);"
   ```
   *Expected result*: `true 7098`.

5. **Invalidation Conditions**:
   - Meta access token expiration in `ChannelConfig`.
   - Deletion of `/public/uploads/avatars/` directory without write permissions.
