## 2026-10-06T08:25:54Z

You are an Explorer subagent (Codebase Explorer R2 & R4).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4

MANDATORY: You MUST read the original request at:
c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md (under ## Follow-up — 2026-10-06T08:21:10Z).

Your objective is to investigate and map the technical requirements and existing implementation for:
Requirement R2: Enriquecimiento Persistente de Perfiles (Username, Display Name y Avatar)
Requirement R4: Sincronización Retroactiva de Conversaciones Previas (Backfill de Historial).

Specifically investigate and document:
1. For R2 (Profiles & Avatars):
   - How are incoming Instagram messages processed currently in `app/api/webhooks/instagram/route.ts` and `lib/instagram-profile.ts`?
   - What fields are returned by Meta Graph API for Instagram users (`username`, `name`, `profile_picture_url`)?
   - How are WhatsApp profiles resolved or fetched?
   - How should avatars be downloaded and cached locally into `/public/uploads/avatars/` to prevent expiration of ephemeral Meta CDN URLs?
   - How are `ChatThread` (e.g. `title`, `metadata`, `avatarUrl`) and `CRMClient` (e.g. `name`, `avatar`, `instagramHandle`, `metadata`) updated in `prisma/dev.db`? Check `schema.prisma`.
2. For R4 (Historical Backfill):
   - Meta Graph API conversation history endpoint: `GET /{ig_account_id}/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}`.
   - What credentials/tokens are configured in `ChannelConfig` (Account ID `29643476368611224`, tokens)?
   - How does pagination work with cursor / `paging.next` in Meta Graph API?
   - Deduplication: how are threads and messages keyed by `externalId` (e.g. Meta message ID `mid`) to avoid duplicates with existing records in SQLite `prisma/dev.db`?
   - UI trigger: Where should the "Sincronizar Histórico" button / action be placed in the omnichannel interface? Server action or API route?

Deliverables:
- Write your detailed investigation report to:
  `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4\analysis.md`
- Write your completion handoff to:
  `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r2_r4\handoff.md`
- Send a completion message back to the orchestrator with a summary of findings and the report path.
