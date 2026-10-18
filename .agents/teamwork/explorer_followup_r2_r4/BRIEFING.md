# BRIEFING — 2026-10-06T08:39:15Z

## Mission
Investigate and map technical requirements and implementation for R2 (Profile/Avatar Enrichment) and R4 (Historical Backfill).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4
- Original parent: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Milestone: follow-up-investigation-r2-r4

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Produce structured analysis.md and handoff.md in working directory
- Strict evidence-based observations with exact file paths and line numbers
- Respect AGENTS.md rules and project architecture

## Current Parent
- Conversation ID: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Updated: 2026-10-06T08:39:15Z

## Investigation State
- **Explored paths**:
  - `prisma/schema.prisma` & SQLite `prisma/dev.db`
  - `app/api/webhooks/instagram/route.ts` & `lib/instagram-profile.ts`
  - `app/api/webhooks/whatsapp/route.ts` & `lib/meta-whatsapp.ts`
  - `app/api/webhooks/evolution/route.ts` & `lib/evolution-api.ts`
  - `lib/meta-graph-api.ts` & `app/actions/omnichannel.ts`
  - `components/shared/omnichannel/unified-omnichannel-view.tsx` & `components/floreria/omnichannel-config-modal.tsx`
  - Live Meta Graph API endpoints (`graph.instagram.com/v22.0/me`, `/me/conversations`, `/{customer_id}`)
- **Key findings**:
  - Found critical bug in `lib/instagram-profile.ts`: `graph.instagram.com` rejects `profile_picture_url` with HTTP 400 error. The correct field is `profile_pic`, which succeeds 200 OK returning `id`, `username`, `name`, and avatar CDN URL.
  - Live verification proved `graph.instagram.com/v22.0/me/conversations` returns real historical threads dating back to 2022 with pagination (`paging.next` and cursor) and attachments (`image_data`, `video_data`, `file_url`).
  - `ChannelConfig` in SQLite contains active Instagram User Token (`IGAA...`, 182 chars) and Account ID `29643476368611224`.
  - Dedup is mapped to `ChatThread` unique compound key `[channel, phone, environment]` and `ChatMessage.externalId` (Meta `mid`).
  - Proposed local avatar caching into `/public/uploads/avatars/` to prevent CDN link expiration.
  - Determined optimal placement for "Sincronizar Histórico" button in `unified-omnichannel-view.tsx` top header and `OmnichannelConfigModal`.
- **Unexplored areas**: None for R2/R4 scope.

## Key Decisions Made
- Document the exact bug fix for `lib/instagram-profile.ts` in the analysis report so the implementer subagent can apply it immediately.
- Document exact field schemas, API contracts, Server Action design, and deduplication logic.

## Artifact Index
- DISPATCH.md — Dispatch log
- progress.md — Liveness heartbeat
- BRIEFING.md — Situational awareness
- analysis.md — Detailed technical analysis report
- handoff.md — 5-component handoff report
