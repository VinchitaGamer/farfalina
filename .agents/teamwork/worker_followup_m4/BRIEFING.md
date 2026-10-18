# BRIEFING — 2026-10-06T10:07:30Z

## Mission
Implement Milestone M4: Sincronización Retroactiva de Conversaciones Previas — Backfill de Historial (Instagram Graph API, Server Action, UI Button, Verification Script).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m4
- Original parent: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Milestone: M4 (Historical Backfill)

## 🔒 Key Constraints
- Stack: Next.js App Router, Prisma ORM, Tailwind CSS, Shadcn UI, Zustand (no React Context).
- All Server Actions must strictly return `{ success, data, error, code }`.
- Deduplication: Idempotent message ingestion using `ChatMessage.externalId = message.id` (Meta `mid`).
- Boundaries:
  - `lib/meta-graph-api.ts`
  - `app/actions/omnichannel.ts`
  - `components/shared/omnichannel/unified-omnichannel-view.tsx`
  - `scripts/verify-historical-backfill.ts`
- Zero compilation errors (`npx tsc --noEmit`).
- Genuine logic, no facade/dummy data.

## Current Parent
- Conversation ID: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Updated: 2026-10-06T10:07:30Z

## Task Summary
- **What to build**:
  1. `fetchHistoricalInstagramConversations` in `lib/meta-graph-api.ts` with pagination and attachment support.
  2. `syncHistoricalConversationsAction` in `app/actions/omnichannel.ts` with profile enrichment, thread upsert, message deduplication.
  3. UI button "Sincronizar Histórico" in `components/shared/omnichannel/unified-omnichannel-view.tsx`.
  4. Test and verify backfill script `scripts/verify-historical-backfill.ts`.
- **Success criteria**:
  - Historical conversations and messages fetched from Meta Graph API.
  - Saved to Prisma `ChatThread` and `ChatMessage`.
  - Second execution creates 0 duplicates.
  - UI button triggers action with loading state and toast feedback.
  - `tsc --noEmit` clean.

## Change Tracker
- **Files modified**: TBD
- **Build status**: pending
- **Pending issues**: none

## Quality Status
- **Build/test result**: pending
- **Lint status**: pending
- **Tests added/modified**: `scripts/verify-historical-backfill.ts`

## Loaded Skills
- clean-code: Zod, TypeScript typing, function conventions, early returns
- backend-integration: Bilateral JSON response `{ success, data, error, code }`, native fetch
- rendering-and-state: Server Actions, client components, state management
- design-system: Shadcn UI, Tailwind CSS, Lucide icons

## Key Decisions Made
- [TBD]

## Artifact Index
- DISPATCH.md
- progress.md
- changes.md
- handoff.md
