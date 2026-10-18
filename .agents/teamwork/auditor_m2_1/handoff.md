# Handoff Report: Forensic Audit for Milestone M2

**Date**: 2026-10-06  
**From**: Forensic Auditor M2 (`auditor_m2_1`)  
**To**: Orchestrator (`1e373fa0-941b-417b-b7c3-a8dd99f78b05`)  
**Type**: Hard Handoff  
**Verdict**: CLEAN  

---

## 1. Observation

1. **Direct Meta Graph API Query**:
   - Query executed directly via Node.js native `fetch`:
     `https://graph.instagram.com/v22.0/1304358138230682?fields=id,username,name,profile_pic&access_token=...`
   - Response:
     - HTTP Status: `200 OK`
     - Body:
       ```json
       {
         "id": "1304358138230682",
         "username": "acido_juan",
         "name": "no juan",
         "profile_pic": "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/742447294_18045017732607423_4684767634876646215_n.jpg?..."
       }
       ```
   - Negative test with legacy `profile_picture_url` returned:
     - HTTP Status: `400 Bad Request`
     - Error: `Tried accessing nonexisting field (profile_picture_url)` (`IGApiException`, code: 100)
   - Negative test with invalid IGSID `999999999999999999` returned:
     - HTTP Status: `500`
     - Error: `OAuthException` code 2.

2. **Physical Avatar Binary Inspection**:
   - Path on disk: `public/uploads/avatars/ig_1304358138230682.jpg`
   - Size: `7098 bytes`
   - Magic header bytes: `ffd8ffe000104a464946` (valid JPEG / JFIF)
   - Trailer marker: `ffd9` (valid JPEG EOI)
   - Comparison with fresh Meta CDN download:
     - Meta CDN buffer length: `7098 bytes`
     - Content-Type: `image/jpeg`
     - Match: 100% byte-for-byte identical.

3. **Direct SQLite Database Queries (`prisma/dev.db`)**:
   - Table `ChatThread` (`phone = '1304358138230682'`):
     - `clientName`: `@acido_juan`
     - `profilePicUrl`: `/uploads/avatars/ig_1304358138230682.jpg`
     - `channel`: `Instagram`
     - `environment`: `farfalina`
   - Table `CRMClient` (`phone = '1304358138230682'`):
     - `name`: `@acido_juan`
     - `notes`: `Origen: INSTAGRAM | Canal: Instagram Direct | IGSID: 1304358138230682 | Username: @acido_juan | Avatar: /uploads/avatars/ig_1304358138230682.jpg`

4. **Codebase Grep Scan for Hardcoding**:
   - Query `acido_juan`:
     - Matched exclusively in `scripts/verify-profile-enrichment.ts` (lines 12, 40, 41, 46, 128, 129, 149, 150, 152, 153).
     - 0 matches in `lib/instagram-profile.ts` and `app/api/webhooks/instagram/route.ts`.
   - Query `1304358138230682`:
     - Matched in test scripts and JSDoc comment example line 112 of `lib/instagram-profile.ts`.
     - 0 matches in production logic.

5. **Test Suite & Build Verification**:
   - Command `npx tsx scripts/verify-profile-enrichment.ts`: exited code 0 (All 5 stages passed).
   - Command `npx tsx scripts/verify-outbound-media.ts`: exited code 0 (24 passed, 0 failed).
   - Command `npx tsc --noEmit`: exited code 0 with 0 errors.

---

## 2. Logic Chain

1. **Meta Graph API Query Integrity**:
   - Based on Observation 1, Meta Graph API v22.0 natively returns user profile data (`id`, `username`, `name`, `profile_pic`) for customer IGSIDs when queried with `fields=id,username,name,profile_pic`.
   - The failure of `profile_picture_url` (Observation 1) proves that the worker's refactoring from `profile_picture_url` to `profile_pic` in `lib/instagram-profile.ts` was necessary and based on empirical Meta API constraints.
   - The absence of hardcoded username responses (Observation 4) and live verification against Meta servers confirms that the profile data originates from Meta.

2. **Avatar Binary Caching Integrity**:
   - Based on Observation 2, `public/uploads/avatars/ig_1304358138230682.jpg` is a genuine JPEG file downloaded from Meta CDN rather than a synthetic placeholder.
   - The file size matches the live Meta CDN payload exactly (7,098 bytes), and header/trailer bytes correspond to standard JPEG specifications.
   - The local path `/uploads/avatars/ig_1304358138230682.jpg` matches Next.js static asset serving rules and is properly referenced in `ChatThread` and `CRMClient`.

3. **Persistence and E2E Flow Integrity**:
   - Based on Observation 3, when webhook events are ingested, `processInstagramMessage` calls `getInstagramUserProfile`, updates `ChatThread`, and synchronizes `CRMClient` in `prisma/dev.db`.
   - Based on Observation 5, all automated verification scripts pass cleanly and the TypeScript compiler validates total type safety across the project.

---

## 3. Caveats

1. **WhatsApp Contact Pictures**:
   - Meta WhatsApp Business Cloud API does not expose a public profile picture URL for individual contacts (only business profiles and incoming webhook push names are provided). User avatars on WhatsApp are therefore subject to third-party provider availability (e.g. Evolution API), as documented in worker caveats.
2. **Meta Token Lifecycle**:
   - The Meta Graph API query requires a valid access token in `ChannelConfig`. If the token expires or is revoked, `getInstagramUserProfile` gracefully falls back to returning `null` or existing disk cache without throwing fatal exceptions.

---

## 4. Conclusion

**Verdict: CLEAN**.

Milestone M2 is fully verified and free of any integrity violations, facade implementations, hardcoded shortcuts, or fabricated outputs. The implementation in `lib/instagram-profile.ts`, `app/api/webhooks/instagram/route.ts`, and `scripts/verify-profile-enrichment.ts` completely satisfies the requirements of `ORIGINAL_REQUEST.md` (§R2) and `PROJECT.md`. Milestone M2 is certified for production and milestone dependencies may proceed to Milestone M3.

---

## 5. Verification Method

To independently reproduce the audit findings:

1. **Verify Meta Graph API Query Live**:
   ```powershell
   node -e "const db = new (require('better-sqlite3'))('prisma/dev.db'); const row = db.prepare('SELECT instagramAccessToken FROM ChannelConfig WHERE channel = ? AND environment = ?').get('Instagram', 'farfalina'); fetch('https://graph.instagram.com/v22.0/1304358138230682?fields=id,username,name,profile_pic&access_token=' + row.instagramAccessToken).then(r => r.json()).then(d => console.log('Username:', d.username, 'Name:', d.name, 'Avatar:', d.profile_pic?.substring(0, 50)));"
   ```
   *Expected*: `Username: acido_juan Name: no juan Avatar: https://instagram...`

2. **Verify Avatar Binary Magic Bytes & Size**:
   ```powershell
   node -e "const fs = require('fs'); const buf = fs.readFileSync('public/uploads/avatars/ig_1304358138230682.jpg'); console.log('Size:', buf.length, 'JPEG Header:', buf.subarray(0, 4).toString('hex'));"
   ```
   *Expected*: `Size: 7098 JPEG Header: ffd8ffe0`

3. **Verify SQLite Database Records**:
   ```powershell
   node -e "const db = new (require('better-sqlite3'))('prisma/dev.db'); console.log('Thread:', db.prepare('SELECT clientName, profilePicUrl FROM ChatThread WHERE phone = ?').get('1304358138230682')); console.log('Client:', db.prepare('SELECT name, notes FROM CRMClient WHERE phone = ?').get('1304358138230682'));"
   ```
   *Expected*: `Thread: { clientName: '@acido_juan', profilePicUrl: '/uploads/avatars/ig_1304358138230682.jpg' }` and matching `CRMClient` record.

4. **Run Automated Test Suite**:
   ```powershell
   npx tsx scripts/verify-profile-enrichment.ts
   npx tsc --noEmit
   ```
   *Expected*: Exit code 0, 0 errors.

5. **Invalidation Conditions**:
   - Alteration of `lib/instagram-profile.ts` to re-introduce `profile_picture_url`.
   - Expiration or revoking of Meta Graph API access token in `ChannelConfig`.
   - Removal of `/public/uploads/avatars/` directory permissions.
