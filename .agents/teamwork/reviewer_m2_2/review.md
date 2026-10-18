# Milestone M2 Review Report: Enriquecimiento Persistente de Perfiles

**Reviewer**: Reviewer 2 (`reviewer_m2_2`)  
**Roles**: Reviewer, Adversarial Critic  
**Date**: 2026-10-06  
**Scope**: Milestone M2 — Instagram Profile Enrichment (Username, Display Name, Local Avatar Caching and SQLite Persistence)  
**Target Files**: `lib/instagram-profile.ts`, `app/api/webhooks/instagram/route.ts`, `scripts/verify-profile-enrichment.ts`  

---

## 1. Review Summary

**Verdict**: **APPROVE**

Worker M2 has delivered a robust, high-integrity implementation that strictly adheres to the requirements of `ORIGINAL_REQUEST.md` (Follow-up R2) and `PROJECT.md` (M2). The solution addresses the root causes of prior failures (replacing the unsupported `profile_picture_url` with `profile_pic` on Meta Graph API v22.0 customer endpoints, implementing local avatar disk caching to eliminate ephemeral CDN token expiration, and establishing atomic persistence in both `ChatThread` and `CRMClient`).

No integrity violations, dummy implementations, or hardcoded cheats were found. All automated verification suites and TypeScript compiler checks pass with 100% success.

---

## 2. Integrity Audit

- **Hardcoded Test Results / Expected Outputs**: PASS. An exhaustive grep across the codebase verified that test identifiers (`@acido_juan`, `1304358138230682`) are present strictly within the test script `scripts/verify-profile-enrichment.ts`. No production logic contains synthetic returns or hardcoded user mocks.
- **Dummy or Facade Implementations**: PASS. Real network queries against `https://graph.instagram.com/v22.0/` and `https://graph.facebook.com/v22.0/`, genuine binary stream downloading via native `fetch`, local file persistence to disk, and real SQLite database transactions.
- **Shortcuts / Task Bypasses**: PASS. Full implementation of local avatar caching with TTL (24h), directory existence validation, Zod validation schemas, and database updates for both threads and CRM records.
- **Fabricated Outputs or Logs**: PASS. Independently validated by executing the test script and verifying the database records and physical file on disk directly.
- **Self-Certifying Work**: PASS. Independent verification performed by this reviewer confirming disk contents, SQLite rows, and TypeScript compilation.

---

## 3. Verified Claims

| Claim | Verification Method | Status |
|---|---|---|
| Meta Graph API endpoint accepts `profile_pic` and returns customer profile | Executed `npx tsx scripts/verify-profile-enrichment.ts` (Stage 2) against live Graph API for IGSID `1304358138230682` | **PASS** (Returned username `@acido_juan`, name `no juan`, and valid CDN URL) |
| Local avatar download to `/public/uploads/avatars/ig_${customerId}.jpg` | Inspected disk at `public/uploads/avatars/ig_1304358138230682.jpg` using Node `fs.statSync` | **PASS** (File exists, size: 7,098 bytes, valid JPEG) |
| Avatar cache reuse avoids duplicate downloads | Executed test Stage 4, re-querying profile within 24h TTL | **PASS** (Reused local web path `/uploads/avatars/ig_1304358138230682.jpg`) |
| Webhook updates `ChatThread` with `@username` and local avatar | Queried `prisma/dev.db` table `ChatThread` for phone `1304358138230682` | **PASS** (`clientName: "@acido_juan"`, `profilePicUrl: "/uploads/avatars/ig_1304358138230682.jpg"`) |
| Webhook updates `CRMClient` name and metadata notes | Queried `prisma/dev.db` table `CRMClient` for phone `1304358138230682` | **PASS** (`name: "@acido_juan"`, `notes` contains origin, handle, and avatar URL) |
| Strict TypeScript typing without compiler errors | Executed `npx tsc --noEmit` | **PASS** (0 errors) |

---

## 4. Adversarial Review & Attack Surface Analysis

### Challenge 1: Filename Sanitization & Path Traversal (Low Risk)
- **Assumption Challenged**: Contact IDs provided by Meta or webhook payloads are always well-behaved numeric strings.
- **Attack Scenario**: An adversarial or spoofed webhook provides a `senderId` like `../../etc/passwd` or malicious symbols.
- **Defense Validation**: `lib/instagram-profile.ts` explicitly runs `const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "_")` before constructing `filename = ${prefix}_${cleanId}.jpg`. Path traversal tokens (`..`, `/`, `\`) are replaced with underscores, strictly scoping writes to `AVATARS_DIR`.
- **Verdict**: Robust defense verified.

### Challenge 2: Network Latency / Slow Meta CDN Hanging Webhook (Medium Risk)
- **Assumption Challenged**: Meta CDN image downloads respond instantaneously.
- **Attack Scenario**: Meta CDN experiences severe latency or network stalling, causing webhook invocations to hang and trigger Meta retry storms.
- **Defense Validation**: `cacheAvatarLocally` uses `AbortSignal.timeout(8000)` and `getInstagramUserProfile` uses `AbortSignal.timeout(6000)`. Any hanging network request aborts cleanly within seconds. Furthermore, `cacheAvatarLocally` falls back to an existing disk copy if download fails.
- **Verdict**: Resilient timeout guards verified.

### Challenge 3: Avatar File Extension & Content-Type (Minor Observation)
- **Observation**: Avatares are persisted with a hardcoded `.jpg` extension (`${prefix}_${cleanId}.jpg`), regardless of whether the remote image is PNG, WEBP, or JPEG.
- **Impact Assessment**: Meta Graph API profile pictures are standard JPEGs (`dst-jpg_...`). Even if a user uploads a PNG/WEBP that Meta stores in original format, modern web browsers decode image formats by magic numbers/content sniffing rather than relying solely on the file extension.
- **Mitigation Suggestion**: In a future optimization, optionally inspect `res.headers.get("content-type")` to set `.png` / `.webp` / `.jpg`. For the current scope, `.jpg` works without issue.

### Challenge 4: High-Concurrency SQLite Contention (Low Risk)
- **Assumption Challenged**: Multiple inbound webhook messages for a new user could arrive concurrently.
- **Attack Scenario**: Two concurrent webhook requests arrive simultaneously for a new contact; both might evaluate `existingClient == null` and attempt `prisma.cRMClient.create`, triggering a unique constraint error on `phone`.
- **Defense Validation**: The CRM synchronization block in `app/api/webhooks/instagram/route.ts` is wrapped in an isolated `try / catch (crmErr)` block. Even if a race condition occurs, it logs a warning without aborting the webhook transaction or returning HTTP 500 to Meta.
- **Verdict**: Defended against fatal crashing.

---

## 5. Quality & Architecture Compliance

1. **Clean Code & AGENTS.md Conformance**:
   - Zero `any` types in `lib/instagram-profile.ts` and `app/api/webhooks/instagram/route.ts`.
   - Zod schemas used as the single source of truth for types (`InstagramUserProfileSchema`, `MetaGraphProfileResponseSchema`, `ProcessInstagramMessageSchema`).
   - Early returns applied throughout functions to avoid deep nesting.
   - Kebab-case naming used for files (`instagram-profile.ts`, `verify-profile-enrichment.ts`).

2. **UI Integration**:
   - `unified-omnichannel-view.tsx` consumes `thread.profilePicUrl` directly in the thread list, header, and client drawer.
   - Because `profilePicUrl` points to `/uploads/avatars/ig_${customerId}.jpg`, Next.js static asset serving serves the image locally, immune to Meta CDN URL expirations.

---

## 6. Conclusion

Milestone M2 fulfills all acceptance criteria with exceptional engineering rigor. The solution is approved for merge and progression to Milestone M3 (Posts y Comentarios de Instagram).
