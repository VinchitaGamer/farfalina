# Changes Report: Milestone M4 — Sincronización Retroactiva de Conversaciones Previas (Backfill de Historial)

**Worker Subagent**: `worker_followup_m4`  
**Date**: 2026-10-06  
**Milestone**: M4  
**Status**: Completed & Verified 100% against Live Meta Graph API and SQLite  

---

## 1. Summary of Changes

Milestone M4 implemented the end-to-end historical backfill system for Instagram Direct conversations:
1. **Graph API Pagination & Ingestion Engine (`lib/meta-graph-api.ts`)**:
   - Implemented `fetchHistoricalInstagramConversations` with cursor-based pagination traversing `paging.next` at both conversation and nested message levels.
   - Built robust attachment normalization supporting `image_data`, `video_data`, `audio_data`, `file_url`, `generic_template`, and `shares`.
   - Strong typing and schemas via Zod (`HistoricalConversationSchema`, `HistoricalMessageSchema`, `HistoricalAttachmentSchema`).
2. **Server Action Backfill Engine (`app/actions/omnichannel.ts`)**:
   - Implemented `syncHistoricalConversationsAction(params)` conforming to Rule 7 of `AGENTS.md` and bilateral JSON response contract `{ success, data, error, code }`.
   - Authenticated against active `ChannelConfig` Instagram credentials (`IGAA...`, account ID `29643476368611224`).
   - Customer vs. Business separation excluding business account ID (`29643476368611224`, `17841406898817900`) and handles (`sour_jhxn`, `carissma_vestidos`).
   - Profile resolution with `getInstagramUserProfile`, setting `@username` and local avatar path.
   - CRM persistence creating/updating `CRMClient` records.
   - Idempotent upserting of `ChatThread` records.
   - 100% strict message deduplication via `ChatMessage.externalId` (Meta `mid`), preventing duplication across multiple runs.
   - Permanent disk caching of remote attachments via `downloadAndCacheMetaMedia`.
   - Chronological message sequencing and thread `lastMessage`/`lastMessageAt` maintenance.
3. **Omnichannel UI Header Button (`components/shared/omnichannel/unified-omnichannel-view.tsx`)**:
   - Added visible "Sincronizar Histórico" button in the Relay Control Bar alongside existing action buttons.
   - Loading indicator with animated spinner (`RefreshCw className="animate-spin"`) and `isSyncingHistory` state.
   - Real-time toast notifications detailing imported conversations, messages, and skipped duplicates.
   - Auto-refreshes inbox thread list upon completion.
4. **Automated Verification Script (`scripts/verify-historical-backfill.ts`)**:
   - 6-step automated test querying real Meta account, testing initial import, inspecting SQLite records, verifying 0 duplicates on re-run, and checking media on disk.

---

## 2. File-by-File Details

### 2.1 `lib/meta-graph-api.ts`
- **Added**:
  - `HistoricalAttachmentSchema`, `HistoricalMessageSchema`, `HistoricalConversationSchema`.
  - Exported interfaces `HistoricalAttachment`, `HistoricalMessage`, `HistoricalConversation`, `FetchHistoricalConversationsOptions`, `FetchHistoricalConversationsResult`.
  - Helper `parseRawAttachments(rawAttachments: unknown): HistoricalAttachment[]` resolving all Meta attachment structures.
  - `fetchHistoricalInstagramConversations(options: FetchHistoricalConversationsOptions)` with multi-page loop for conversations and nested messages.
  - Addressed TypeScript circular type inference on fetch loop variables.

### 2.2 `app/actions/omnichannel.ts`
- **Added**:
  - Imports: `fetchHistoricalInstagramConversations`, `downloadAndCacheMetaMedia`, `getInstagramUserProfile`.
  - Exported types: `SyncHistoricalConversationsParams`, `SyncHistoricalResult`.
  - Exported Server Action: `syncHistoricalConversationsAction(params?: string | SyncHistoricalConversationsParams): Promise<ActionResponse<SyncHistoricalResult>>`.
  - Comprehensive customer participant resolution, profile enrichment, `CRMClient` upsert, `ChatThread` upsert, and `ChatMessage` deduplicated creation.

### 2.3 `components/shared/omnichannel/unified-omnichannel-view.tsx`
- **Added**:
  - Imported `syncHistoricalConversationsAction`.
  - State: `const [isSyncingHistory, setIsSyncingHistory] = useState(false)`.
  - Handler: `handleSyncHistorical()` calling server action, rendering toast notifications, and calling `loadThreads()`.
  - UI Button: Added "Sincronizar Histórico" button in top Relay Control Bar with responsive label and tooltip.

### 2.4 `scripts/verify-historical-backfill.ts`
- **Created**:
  - Automated verification test suite running live against Meta Graph API and `prisma/dev.db`.
  - Validates credential availability, initial SQLite baseline, first backfill execution, SQLite record schema conformance, second execution deduplication check (0 duplicates created), and disk media persistence.

---

## 3. Verification Summary

- **TypeScript Compilation**: `npx tsc --noEmit` exited with status `0` (0 errors).
- **Automated Verification Script**: `npx tsx scripts/verify-historical-backfill.ts` passed 100%:
  - First run imported 132 real messages across 5 conversations.
  - Second run inserted 0 new messages and skipped 144 duplicates (100% idempotent).
  - SQLite message count remained exactly constant.
  - Cached media files verified on disk in `/public/uploads/instagram/`.
