# Milestone M2 Review & Adversarial Challenge Report

**Date**: 2026-10-06  
**Reviewer**: Reviewer 1 (`reviewer_m2_1`)  
**Scope**: Milestone M2 — Enriquecimiento Persistente de Perfiles (Username, Display Name y Avatar Local)  
**Target Files**: `lib/instagram-profile.ts`, `app/api/webhooks/instagram/route.ts`  
**Verdict**: **APPROVE**  
**Risk Assessment**: **LOW**

---

## 1. Quality Review

### Review Summary
**Verdict**: **APPROVE**  
The implementation fully satisfies Requirement R2 of the follow-up request. Meta Graph API v22.0 query fields have been corrected (`profile_pic` replacing the rejected `profile_picture_url`), binary avatar download and 24-hour local disk caching in `/public/uploads/avatars/` is robustly implemented with path traversal sanitization, and inbound webhook processing persists enriched usernames (`@acido_juan`) and local avatar URLs (`/uploads/avatars/ig_${customerId}.jpg`) into both `ChatThread` and `CRMClient` in SQLite `prisma/dev.db`. Code quality strictly satisfies all `AGENTS.md` rules: zero `any` types, Zod schemas as the single source of truth for types, early returns, and compliant `{ success, data, error, code }` response contracts.

### Findings

#### [Minor] Finding 1: Absence of Proactive Invalidation for User Avatar Updates
- **What**: Avatar images are cached locally with a 24-hour TTL (`AVATAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000`). If an Instagram user updates their profile picture on Instagram, the new avatar will not be refreshed locally until 24 hours have elapsed since the previous download.
- **Where**: `lib/instagram-profile.ts:33, 72`
- **Why**: Meta Webhooks for Instagram Direct do not emit an event when an end-user updates their profile picture. Without a manual re-fetch trigger, the cached avatar remains static for up to 24 hours.
- **Suggestion / Assessment**: Accept as reasonable compromise. A 24-hour TTL prevents excessive outbound requests to Meta Graph API and CDN while ensuring stale avatars do not persist indefinitely. No change required for M2.

#### [Minor] Finding 2: Lack of Native Customer Profile Pic in WhatsApp Business Cloud API
- **What**: Profile picture caching is implemented for Instagram (`ig_${cleanId}.jpg`) and Facebook (`fb_${cleanId}.jpg`), but not for WhatsApp Cloud API.
- **Where**: `lib/instagram-profile.ts:50-57`, `app/api/webhooks/instagram/route.ts`
- **Why**: Meta's WhatsApp Business Cloud API does not expose a public profile picture endpoint for customer phone numbers due to WhatsApp end-user privacy policies; only push names are included in webhook contact payloads. Contact avatars for WhatsApp require Evolution API or an unofficial bridge.
- **Suggestion / Assessment**: Correctly identified and documented in worker caveats. Out of scope for Instagram Direct M2.

---

## 2. Integrity & Authenticity Assessment

- **Hardcoded test results or expected outputs embedded in source code**: **NONE FOUND**. The implementation code in `lib/instagram-profile.ts` and `app/api/webhooks/instagram/route.ts` contains no hardcoded test user IDs, usernames, or pre-rendered mock responses.
- **Dummy or facade implementations**: **NONE FOUND**. The Graph API client performs real HTTP requests to `https://graph.instagram.com/v22.0/{customerId}` and `https://graph.facebook.com/v22.0/{customerId}`, downloads binary data, verifies buffer size, writes binary files to disk, and updates SQLite tables via Prisma ORM.
- **Verification authenticity**: **VERIFIED DIRECTLY**. Reviewer directly inspected the generated avatar file (`public/uploads/avatars/ig_1304358138230682.jpg`, 7,098 bytes), verifying it is a genuine, high-quality JPEG image retrieved from Meta CDN. The database was independently queried via SQLite driver, confirming real persistence.
- **Integrity Tag**: **PASSED (100% Genuine Implementation)**.

---

## 3. Verified Claims

| Claim | Verification Method | Result |
|---|---|---|
| Meta Graph API v22.0 returns HTTP 200 with `fields=id,username,name,profile_pic` | Live execution via `scripts/verify-profile-enrichment.ts` querying `@acido_juan` (`1304358138230682`) | **PASS** |
| Avatar binary is downloaded and saved to disk (`/public/uploads/avatars/`) | Inspected `public/uploads/avatars/ig_1304358138230682.jpg` (7,098 bytes, valid JPEG) | **PASS** |
| Local cache reuse works without redundant downloads | Re-executed profile query within 24h window; verified cached path returned immediately | **PASS** |
| Webhook updates `ChatThread.clientName` to `@acido_juan` | Queried `prisma/dev.db` via `better-sqlite3` on `ChatThread` where `phone = '1304358138230682'` | **PASS** |
| Webhook updates `ChatThread.profilePicUrl` to local path | Confirmed `/uploads/avatars/ig_1304358138230682.jpg` in `ChatThread` | **PASS** |
| Webhook enriches `CRMClient.name` and `CRMClient.notes` | Confirmed `name = '@acido_juan'` and notes contain origin, username, and local avatar URL in `CRMClient` | **PASS** |
| TypeScript strict compilation without errors | Executed `npx tsc --noEmit` -> exit code 0, 0 errors | **PASS** |
| Adherence to AGENTS.md (no `any`, Zod schemas, early returns) | Grepped entire codebase for `\bany\b`, inspected Zod schemas and early returns | **PASS** |

---

## 4. Adversarial Review & Attack Surface Analysis

**Overall Risk Assessment**: **LOW**

### Challenges & Stress Tests

#### Challenge 1: Path Traversal via Malicious Customer ID
- **Assumption**: `customerId` passed to `cacheAvatarLocally` could contain directory traversal characters (e.g. `../../etc/evil.jpg`).
- **Attack Scenario**: An attacker supplies a crafted PSID or sender ID containing `../`.
- **Mitigation Inspected**: In `lib/instagram-profile.ts:63`:
  ```ts
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${prefix}_${cleanId}.jpg`;
  ```
  All characters outside `[a-zA-Z0-9_-]` are converted to underscores. Traversal sequences like `../../` become `____` and cannot escape `public/uploads/avatars/`.
- **Verdict**: **DEFENDED (PASS)**.

#### Challenge 2: Network Timeout or Remote CDN Failure
- **Assumption**: Meta CDN or Graph API may hang or return HTTP errors (e.g. 504 Gateway Timeout, 403 Forbidden).
- **Attack Scenario**: Graph API hangs for >30 seconds, causing incoming webhooks to time out and Meta to retry repeatedly.
- **Mitigation Inspected**:
  - `AbortSignal.timeout(6000)` on Graph API calls (`lib/instagram-profile.ts:134, 165`).
  - `AbortSignal.timeout(8000)` on avatar CDN downloads (`lib/instagram-profile.ts:81`).
  - Graceful fallback: If download fails but a local file exists from a previous run, the local file is served; if no local file exists, the remote URL is returned.
  - Profile resolution errors in webhook handler (`app/api/webhooks/instagram/route.ts:387`) are wrapped in `try/catch` and do not prevent message ingestion or HTTP 200 dispatch.
- **Verdict**: **DEFENDED (PASS)**.

#### Challenge 3: Empty / 0-Byte Corrupted File Writes
- **Assumption**: Interrupted download might write a 0-byte file to disk, permanently caching a broken image.
- **Attack Scenario**: CDN disconnects immediately after HTTP headers, writing a 0-byte file that triggers cache hit on future checks.
- **Mitigation Inspected**:
  - `if (arrayBuf.byteLength > 0)` ensures 0-byte buffers are never written to disk (`lib/instagram-profile.ts:84`).
  - Cache check validates `if (stats.size > 0 && ...)` before accepting an existing file (`lib/instagram-profile.ts:72`).
- **Verdict**: **DEFENDED (PASS)**.

#### Challenge 4: Webhook Concurrency & Duplicate Message Ingestion
- **Assumption**: Multiple rapid webhooks for the same sender arrive simultaneously.
- **Attack Scenario**: Two webhook calls arrive in parallel, attempting to create the thread or download the avatar at the exact same millisecond.
- **Mitigation Inspected**:
  - `fs.writeFileSync` is synchronous and atomic per process.
  - Message deduplication by `externalId` (`mid`) prevents duplicate insertions in `ChatMessage`.
  - SQLite unique constraint `chatthread_tenant_unique` protects thread integrity.
- **Verdict**: **DEFENDED (PASS)**.

---

## 5. Final Recommendation

**VERDICT**: **APPROVE**  
Milestone M2 is thoroughly implemented, verified against live Meta Graph API endpoints and local SQLite database, and completely compliant with project architecture and coding standards. Ready to proceed to Milestone M3.
