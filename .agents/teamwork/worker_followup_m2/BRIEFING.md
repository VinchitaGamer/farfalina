# BRIEFING — 2026-10-06T09:34:30Z

## Mission
Milestone M2: Enriquecimiento Persistente de Perfiles de Instagram: Username, Display Name y Avatar Local con cache en disco y persistencia en BD (ChatThread y CRMClient).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2
- Original parent: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Milestone: M2 (Enriquecimiento Persistente de Perfiles: Username, Display Name y Avatar Local)

## 🔒 Key Constraints
- Owned files exclusively:
  - `lib/instagram-profile.ts`
  - `app/api/webhooks/instagram/route.ts` (specifically profile enrichment and avatar caching integration)
  - `scripts/verify-profile-enrichment.ts` (automated verification script)
- DO NOT CHEAT: Genuine implementations only. No hardcoded tests or fake outputs.
- Query `https://graph.instagram.com/v22.0/{customerId}?fields=id,username,name,profile_pic&access_token={token}` (DO NOT use `profile_picture_url`).
- Cache avatar binary to `/public/uploads/avatars/ig_${customerId}.jpg`, reference as `/uploads/avatars/ig_${customerId}.jpg`.
- TypeScript strict typing (Zod schema for profile validation).

## Current Parent
- Conversation ID: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Updated: 2026-10-06T09:34:30Z

## Task Summary
- **What to build**: Fix & upgrade `lib/instagram-profile.ts` (fields=id,username,name,profile_pic, local avatar caching), integrate into `app/api/webhooks/instagram/route.ts` for ChatThread & CRMClient updates, and write verification script `scripts/verify-profile-enrichment.ts`.
- **Success criteria**:
  - Live Meta Graph query works for customer ID `1304358138230682` (`@acido_juan`).
  - Image binary downloaded and saved in `public/uploads/avatars/ig_1304358138230682.jpg` (7,098 bytes).
  - ChatThread and CRMClient persisted in database.
  - `npx tsx scripts/verify-profile-enrichment.ts` passes.
  - `npx tsc --noEmit` passes.
- **Interface contracts**: Follow JSON response conventions, Zod validation, Prisma client models.
- **Code layout**: Minimal changes, kebab-case where applicable, no any.

## Change Tracker
- **Files modified**:
  - `lib/instagram-profile.ts`: Fixed Meta Graph API endpoint, added Zod schema, local avatar caching in `/public/uploads/avatars/` with 24h reuse.
  - `app/api/webhooks/instagram/route.ts`: Integrated `getInstagramUserProfile`, enriched `ChatThread` and `CRMClient` with `@username` and local avatar.
  - `scripts/verify-profile-enrichment.ts`: 5-stage automated test script for live profile query, disk storage, and SQLite persistence.
- **Build status**: PASS (`npx tsc --noEmit` exits with 0).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: PASS (Verification script 5/5 passed, tsc 0 errors).
- **Lint status**: Clean (no any, strict typing).
- **Tests added/modified**: `scripts/verify-profile-enrichment.ts`.

## Loaded Skills
- **clean-code**: c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md
- **backend-integration**: c:\Users\Lenovo\Desktop\floreria\.agents\skills\backend-integration\SKILL.md

## Key Decisions Made
- Replaced invalid `profile_picture_url` parameter with valid `profile_pic` parameter in Meta Graph API query.
- Implemented deterministic local file storage at `/public/uploads/avatars/ig_${customerId}.jpg` with 24-hour cache TTL.
- Standardized `ChatThread.clientName` to `@${profile.username}` when available and mapped `/uploads/avatars/ig_${customerId}.jpg` to `ChatThread.profilePicUrl`.
- Recorded handle and avatar path into `CRMClient.notes` without mutating external tables.

## Artifact Index
- `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2\DISPATCH.md` — Dispatch prompt
- `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2\BRIEFING.md` — Persistent state
- `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2\progress.md` — Progress tracker
- `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2\changes.md` — Detailed changes
- `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m2\handoff.md` — Hard handoff report
