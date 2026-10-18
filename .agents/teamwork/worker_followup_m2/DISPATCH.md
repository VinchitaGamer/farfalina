## 2026-10-06T09:26:48Z
You are Worker subagent for Milestone M2 (Enriquecimiento Persistente de Perfiles: Username, Display Name y Avatar Local).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2

MANDATORY: You MUST read the original request at:
c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md (under ## Follow-up — 2026-10-06T08:21:10Z).
Also read:
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4\analysis.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Boundaries:
You own exclusively:
- `lib/instagram-profile.ts`
- `app/api/webhooks/instagram/route.ts` (specifically profile enrichment and avatar caching integration)
- `scripts/verify-profile-enrichment.ts` (automated verification script)

Detailed Objectives:
1. Fix and Upgrade `lib/instagram-profile.ts`:
   - Endpoint: Query `https://graph.instagram.com/v22.0/{customerId}?fields=id,username,name,profile_pic&access_token={token}` (DO NOT use `profile_picture_url` as Meta rejects it with HTTP 400 for customer IDs).
   - Local Avatar Caching: When a valid `profile_pic` URL is returned, download the binary image using native fetch and persist it to `/public/uploads/avatars/ig_{customerId}.jpg` (ensuring `/public/uploads/avatars` directory exists).
   - Public Avatar URL: Set the cached avatar path to `/uploads/avatars/ig_{customerId}.jpg` (accessible via the server and Cloudflare tunnel).
   - If the local avatar file already exists and is recent, reuse it to avoid unnecessary external HTTP calls.
   - Return strongly typed object with `name`, `username`, `profilePicUrl`, and `id`.
2. Update Webhook Processing in `app/api/webhooks/instagram/route.ts`:
   - When receiving incoming messages, ensure `getInstagramUserProfile` is called.
   - Update `ChatThread` with `clientName` (e.g. `profile.name || profile.username ? `@${profile.username}` : senderId`) and `profilePicUrl` with the cached local avatar URL.
   - Update or upsert `CRMClient`: store `name`, `avatar` (cached local avatar URL), and record username in metadata or notes.
3. Verification:
   - Create automated verification script `scripts/verify-profile-enrichment.ts`.
   - Test querying live Meta Graph API for active user `1304358138230682` (confirming `@acido_juan`), downloading avatar to disk, and persisting in SQLite `dev.db`.
   - Run `npx tsx scripts/verify-profile-enrichment.ts` and `npx tsc --noEmit`.
4. Output:
   - Document changes in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2\changes.md`.
   - Document verification results in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2\handoff.md`.
   - Send completion message to orchestrator with summary of changes and test results.
