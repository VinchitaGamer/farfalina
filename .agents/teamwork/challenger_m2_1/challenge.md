# Empirical Challenge Report: Milestone M2

**Target**: Milestone M2 (Enriquecimiento Persistente de Perfiles: Username, Display Name y Avatar Local)  
**Agent**: Challenger 1 (`challenger_m2_1`)  
**Date**: 2026-10-06  
**Verdict**: **APPROVE**  

---

## Challenge Summary

**Overall risk assessment**: **LOW**

Empirical stress testing and adversarial evaluation confirm that the profile fetching and local avatar caching system implemented in `lib/instagram-profile.ts` and integrated in `app/api/webhooks/instagram/route.ts` is resilient against network failures, CDN anomalies, cache expiration, and high concurrency on Windows.

All 14 adversarial test scenarios executed by `challenge-runner.ts` passed successfully. The worker's live verification script `scripts/verify-profile-enrichment.ts` also passed 5/5 stages against live Meta Graph API and local SQLite `prisma/dev.db`, and `npx tsc --noEmit` verified zero compilation or typing errors.

---

## Challenges

### [Low] Challenge 1: Absence of MIME Type / Magic Bytes Verification in Avatar Caching

- **Assumption challenged**: That any HTTP 200 response with `byteLength > 0` received from a remote URL represents valid image data.
- **Attack scenario**: A misconfigured intermediate proxy, CDN captive portal, or Cloudflare challenge returns HTTP 200 OK with `Content-Type: text/html` instead of image binary.
- **Observed behavior**: `cacheAvatarLocally` saves the received payload (e.g. 64-byte HTML string) directly as `ig_${id}.jpg` in `/public/uploads/avatars/`. While it does not throw an exception or crash the server, the browser will attempt to load the HTML as an image, rendering a broken image icon.
- **Blast radius**: Low. Meta Graph CDN URLs (`*.fbcdn.net`) are signed endpoints that return 403/404 on error rather than 200 HTML pages. Furthermore, the server remains completely stable.
- **Mitigation recommendation**: In future iterations, add a lightweight validation check on `res.headers.get("content-type")?.startsWith("image/")` or verify image magic bytes (e.g. `Buffer[0] === 0xff && Buffer[1] === 0xd8` for JPEG) prior to writing to disk.

### [Low] Challenge 2: Cache Eviction / Storage Growth Over Long Horizons

- **Assumption challenged**: Disk storage in `/public/uploads/avatars/` will remain manageable without automatic eviction of obsolete contacts.
- **Attack scenario**: In a high-traffic omnichannel system interacting with tens of thousands of unique Instagram users over months, avatar files accumulate indefinitely without pruning.
- **Blast radius**: Low. Each avatar image is small (~7 KB), so 10,000 avatars occupy ~70 MB.
- **Mitigation recommendation**: Schedule a periodic cron/cleanup task to remove avatars for contacts inactive for more than 90 days.

---

## Stress Test Results

Executed via automated test harness `challenge-runner.ts` (14/14 passed):

| Category | Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **Group A: CDN Resilience** | CDN 404 Not Found | Catch error, avoid writing file, return remoteUrl fallback without crashing | Handled in 76ms; no file created; returned fallback remoteUrl | **PASS** |
| **Group A: CDN Resilience** | CDN 500 Internal Error | Graceful warning, no crash, return remoteUrl fallback | Handled in 12ms; returned fallback remoteUrl | **PASS** |
| **Group A: CDN Resilience** | Malformed/Invalid URLs (`null`, `""`, `ftp://`, garbage string) | Return null or input string without throwing exceptions | 0ms; all non-http/invalid inputs handled cleanly | **PASS** |
| **Group A: CDN Resilience** | Network Refusal (ECONNREFUSED) | Catch network error, log warning, return fallback | Handled in 12ms; caught TCP connect ECONNREFUSED safely | **PASS** |
| **Group A: CDN Resilience** | 0-Byte Empty Body (HTTP 200) | Detect `byteLength === 0`, do NOT write empty file, return fallback | Handled in 8ms; 0-byte file prevented; returned fallback | **PASS** |
| **Group A: CDN Resilience** | Non-Image HTML Body (HTTP 200) | Server handles without throwing or crashing | Handled in 8ms; wrote bytes safely without server error | **PASS** (Advisory) |
| **Group B: Cache TTL** | Fresh Hit (<24h) | Serve from disk without triggering HTTP requests | 12ms; 1 HTTP fetch on cold miss, 0 HTTP fetches on warm hit | **PASS** |
| **Group B: Cache TTL** | Expired Cache (>24h) | Re-fetch from remote CDN and update file `mtime` | 15ms; re-fetched 1x, updated `mtime` to current timestamp | **PASS** |
| **Group B: Cache TTL** | Expired Cache + CDN Failure | Fall back to existing stale disk copy; do not break avatar | 11ms; preserved stale local avatar path `/uploads/avatars/...` | **PASS** |
| **Group C: Concurrency** | 30 Concurrent Requests (Same Profile, Cold Cache Miss) | All promises resolve, no Windows file lock (`EBUSY`), 100% data integrity | 132ms; 30 workers resolved; file matches 10,149 bytes bit-for-bit | **PASS** |
| **Group C: Concurrency** | 30 Concurrent Requests (Same Profile, Expired Re-fetch) | All 30 re-fetch without lock errors or corrupted sizes | 194ms; resolved cleanly; file size intact at 10,149 bytes | **PASS** |
| **Group C: Concurrency** | 50 Concurrent Requests (50 Distinct Contact IDs) | All 50 downloads succeed and create intact avatars | 236ms; 50/50 files created and verified on disk | **PASS** |
| **Group D: Graph API** | OAuth Token Rejection (HTTP 400) | Catch OAuth error, return `null` cleanly without crashing | 902ms; returned `null`; webhook continues smoothly | **PASS** |
| **Group D: Graph API** | Zod Schema Validation | Enforce schema types and support `profilePic` alias | 3ms; strict schema validation passes | **PASS** |

---

## Live System Verification

1. **Worker Verification Suite**:
   - Command: `npx tsx scripts/verify-profile-enrichment.ts`
   - Result: 5/5 stages passed (Meta Graph API query, avatar download 7,098 bytes, cache hit, webhook ingestion, `ChatThread` & `CRMClient` persistence in SQLite `prisma/dev.db`).
2. **TypeScript Compiler Check**:
   - Command: `npx tsc --noEmit`
   - Result: Exited with code 0 (zero errors).
3. **Artifact Hygiene**:
   - Target `/public/uploads/avatars/` verified clean with only legitimate verified avatar `ig_1304358138230682.jpg` (7,098 bytes).

---

## Unchallenged Areas

- **Disk Exhaustion (Out of Disk Space)**: Not tested due to production environment safety constraints. Handled at OS level.

---

## Verdict

**APPROVE**. Milestone M2 satisfies all requirements of R2 with verified resilience, correct TTL caching, robust error handling, and zero data corruption under concurrent load.
