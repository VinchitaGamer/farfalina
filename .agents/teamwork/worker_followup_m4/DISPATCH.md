## 2026-10-06T10:07:12Z
You are Worker subagent for Milestone M4 (Sincronización Retroactiva de Conversaciones Previas — Backfill de Historial).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m4

MANDATORY: You MUST read the original request at:
c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md (under ## Follow-up — 2026-10-06T08:21:10Z).
Also read:
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4\analysis.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Boundaries:
You own:
- `lib/meta-graph-api.ts` (adding historical conversations fetcher with pagination)
- `app/actions/omnichannel.ts` (adding `syncHistoricalConversationsAction`)
- `components/shared/omnichannel/unified-omnichannel-view.tsx` (adding "Sincronizar Histórico" button with loading state)
- `scripts/verify-historical-backfill.ts` (automated test script)

Detailed Objectives:
1. Historical Graph API Query in `lib/meta-graph-api.ts`:
   - Implement `fetchHistoricalInstagramConversations`:
     - Calls `GET https://graph.instagram.com/v22.0/me/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}&access_token={token}`.
     - Supports pagination walking `paging.next` or cursor `after` for both conversations and nested messages.
     - Handles attachment structures (`image_data`, `video_data`, `file_url`, `shares`).
2. Server Action `syncHistoricalConversationsAction` in `app/actions/omnichannel.ts`:
   - Retrieves active Instagram `ChannelConfig`.
   - Iterates through conversations returned from Meta Graph API.
   - Identifies participant external ID (excluding business account `29643476368611224`).
   - Resolves or enriches user profile with `getInstagramUserProfile`.
   - Upserts `ChatThread` (`channel: 'Instagram'`, `phone: participantId`, `environment`, `clientName`, `profilePicUrl`).
   - Deduplicates and inserts each message into `ChatMessage` using `externalId = message.id` (Meta `mid`).
   - If a message with the same `externalId` already exists, skip it (ensuring 100% idempotency).
   - Updates `ChatThread.lastMessage` and `updatedAt`.
   - Returns `{ success: true, data: { syncedConversations, syncedMessages, skippedDuplicates }, code: "SUCCESS" }`.
3. Omnichannel UI Button in `components/shared/omnichannel/unified-omnichannel-view.tsx`:
   - Add a visible "Sincronizar Histórico" button in the header bar (Relay Control Bar, alongside existing action buttons).
   - Hook to `syncHistoricalConversationsAction`, showing loading state (`isSyncingHistory`) and toast notification upon success/failure.
4. Verification:
   - Create automated test script `scripts/verify-historical-backfill.ts`:
     - Test calling `syncHistoricalConversationsAction` against the real configured Meta account.
     - Validate that historical threads and messages are inserted into `prisma/dev.db`.
     - Run a second time to verify deduplication (0 duplicates created).
     - Run `npx tsc --noEmit` ensuring 0 compilation errors.
5. Output:
   - Document changes in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m4\changes.md`.
   - Document verification results in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m4\handoff.md`.
   - Send completion message to orchestrator with summary of changes and test results.
