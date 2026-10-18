# BRIEFING — 2026-10-06T10:04:00Z

## Mission
Implement Milestone M3: Visualización y Respuesta a Publicaciones y Comentarios de Instagram (Prisma models, webhook routing, Graph API reply dispatch, Server Actions, and UI integration).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m3
- Original parent: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Milestone: M3 (Instagram Posts and Comments)

## 🔒 Key Constraints
- Follow AGENTS.md rules strictly:
  - Additive non-breaking Prisma schema changes only
  - Zod validation and types
  - Server Actions format: { success, data, error, code }
  - Strict TypeScript, no `any`
  - Do not route comment webhook events into direct message threads
  - No dummy or facade implementations; real state & logic
  - Scope boundaries: schema.prisma, webhook route, meta-graph-api.ts, omnichannel actions, instagram-posts-panel.tsx, unified-omnichannel-view.tsx, verify-instagram-comments.ts

## Current Parent
- Conversation ID: 1e373fa0-941b-417b-b7c3-a8dd99f78b05
- Updated: 2026-10-06T10:04:00Z

## Task Summary
- **What to build**:
  1. Additive Prisma models `InstagramPost` and `InstagramComment` and sync to SQLite `dev.db`.
  2. Webhook routing for `change.field === 'comments'` in `app/api/webhooks/instagram/route.ts`.
  3. Graph API reply functions in `lib/meta-graph-api.ts` (`replyInstagramCommentPublic`, `replyInstagramCommentPrivate`).
  4. Server actions in `app/actions/omnichannel.ts` (`getInstagramPostsAction`, `getInstagramCommentsAction`, `replyInstagramCommentAction`, `syncInstagramPostsAction`).
  5. Panel component `components/shared/omnichannel/instagram-posts-panel.tsx` & integrate switch in `components/shared/omnichannel/unified-omnichannel-view.tsx`.
  6. Automated test script `scripts/verify-instagram-comments.ts` and verify with `npx tsc --noEmit`.
- **Success criteria**: All features genuinely work, tests pass, tsc passes with 0 errors.
- **Interface contracts**: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md
- **Code layout**: Canonical Next.js App Router layout per AGENTS.md

## Key Decisions Made
- Separated `InstagramPost` and `InstagramComment` into dedicated tables to preserve 1-a-1 clean semantics in `ChatThread`.
- Discriminated `field: 'comments'` in Webhook route to avoid DM thread pollution.
- Used `graph.instagram.com/v22.0` for token calls since `IGAA...` user tokens are rejected on `graph.facebook.com`.
- Added interactive mode switcher in `UnifiedOmnichannelView` header bar.

## Artifact Index
- DISPATCH.md — Assignment and requirements
- BRIEFING.md — Persistent state and identity
- progress.md — Heartbeat and step tracking
- changes.md — Change log
- handoff.md — 5-component handoff report

## Change Tracker
- **Files modified**:
  - `prisma/schema.prisma`: Added `InstagramPost` and `InstagramComment` models.
  - `app/api/webhooks/instagram/route.ts`: Comment event schema and routing in changes loop.
  - `lib/meta-graph-api.ts`: Public and private comment reply dispatch methods and media helpers.
  - `app/actions/omnichannel.ts`: Server Actions for posts, comments, replies and sync.
  - `components/shared/omnichannel/instagram-posts-panel.tsx`: Interactive posts and comments panel.
  - `components/shared/omnichannel/unified-omnichannel-view.tsx`: Mode switch in Relay Control Bar.
  - `scripts/verify-instagram-comments.ts`: Automated test script covering full lifecycle.
- **Build status**: `npx tsc --noEmit` PASS (0 errors), `verify-instagram-comments.ts` PASS (0 exit code).
- **Pending issues**: none

## Quality Status
- **Build/test result**: PASS
- **Lint status**: 0 TypeScript violations
- **Tests added/modified**: `scripts/verify-instagram-comments.ts`

## Loaded Skills
- clean-code: c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md
- backend-integration: c:\Users\Lenovo\Desktop\floreria\.agents\skills\backend-integration\SKILL.md
- nextjs-architecture: c:\Users\Lenovo\Desktop\floreria\.agents\skills\nextjs-architecture\SKILL.md
- design-system: c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md
