## 2026-10-06T09:45:20Z
You are Worker subagent for Milestone M3 (Visualización y Respuesta a Publicaciones y Comentarios de Instagram).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m3

MANDATORY: You MUST read the original request at:
c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md (under ## Follow-up — 2026-10-06T08:21:10Z).
Also read:
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r3\analysis.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Boundaries:
You own:
- `prisma/schema.prisma` (additive models `InstagramPost` and `InstagramComment`)
- `app/api/webhooks/instagram/route.ts` (routing webhook events when `change.field === 'comments'`)
- `lib/meta-graph-api.ts` (public and private comment reply dispatch methods)
- `app/actions/omnichannel.ts` (comment server actions)
- `components/shared/omnichannel/instagram-posts-panel.tsx` (posts & comments panel)
- `components/shared/omnichannel/unified-omnichannel-view.tsx` (view mode switch in header bar)
- `scripts/verify-instagram-comments.ts` (automated test script)

Detailed Objectives:
1. Additive Prisma Models in `prisma/schema.prisma`:
   - Add `InstagramPost` and `InstagramComment` models per AGENTS.md rules (non-breaking, SQLite compatible).
   - Run `npx prisma db push` to synchronize SQLite schema in `prisma/dev.db`.
2. Webhook Comments Routing in `app/api/webhooks/instagram/route.ts`:
   - In lines 286-306, inspect `change.field`.
   - If `change.field === 'comments'`, extract comment payload (`id`, `text`, `from: { id, username }`, `media: { id }`, `parent_id`, `created_time`).
   - Upsert/create `InstagramPost` (with post ID from `media.id`) and create `InstagramComment` linked to the post.
   - DO NOT route comment events to `processInstagramMessage` so direct message threads remain uncorrupted.
3. Graph API Reply Dispatch in `lib/meta-graph-api.ts`:
   - Implement `replyInstagramCommentPublic`: calls `POST https://graph.instagram.com/v22.0/{comment_id}/replies?message={message}&access_token={token}` using token from `ChannelConfig`.
   - Implement `replyInstagramCommentPrivate`: calls `POST https://graph.instagram.com/v22.0/me/messages` with `recipient: { comment_id: commentId }` and `message: { text: message }`.
4. Server Actions in `app/actions/omnichannel.ts`:
   - `getInstagramPostsAction({ environment })`
   - `getInstagramCommentsAction({ postId, environment })`
   - `replyInstagramCommentAction({ commentId, text, replyType: 'public' | 'private', environment })`
   - Ensure `{ success, data, error, code }` response format.
5. Omnichannel UI:
   - Create `components/shared/omnichannel/instagram-posts-panel.tsx`:
     - Displays list of posts, comments thread with author handle, text, timestamp, and response box with public / private toggle.
   - Update `components/shared/omnichannel/unified-omnichannel-view.tsx`:
     - Add header toggle switch between `[💬 Chats Directos]` and `[📸 Publicaciones & Comentarios]`.
6. Verification:
   - Create and run `scripts/verify-instagram-comments.ts`:
     - Test simulating incoming webhook with `field: 'comments'`, asserting persistence in SQLite `dev.db`.
     - Test server action retrieval and reply payload formation.
   - Run `npx tsc --noEmit` ensuring 0 compilation errors.
7. Output:
   - Document changes in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m3\changes.md`.
   - Document verification results in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m3\handoff.md`.
   - Send completion message to orchestrator with summary of changes and test results.
