# Handoff Report: Survey of Instagram Webhook & SQLite Persistence (R2)

**Agent ID:** `teamwork_preview_explorer_survey_2`  
**Parent Agent ID:** `35aa4937-0622-442f-965e-bc1e161ba4f2`  
**Working Directory:** `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_survey_2`  
**Target Milestone:** R2 — Recepción y Persistencia de Mensajes de Instagram Direct en Local  

---

## 1. Observation

1. **GET Webhook Verification**:
   - `app/api/webhooks/instagram/route.ts:25-71`: GET handler verifies `hub.mode === "subscribe"` against `process.env.META_VERIFY_TOKEN`, `DEFAULT_VERIFY_TOKEN` ("farfalina_carissma_webhook_verify_token_2026"), and `prisma.channelConfig.findFirst({ where: { channel: "Instagram", verifyToken: token } })`.
   - Command `npx tsx scripts/verify-meta-webhooks.ts --in-process` executed:
     `[3/3] ✓ Instagram Direct Graph API (/api/webhooks/instagram): 9 pasadas, 0 fallidas (Total: 27 pasadas, 0 fallidas)`. All tests passed with HTTP 200 plain text challenge output.

2. **ChannelConfig in `prisma/dev.db`**:
   - Querying `prisma.channelConfig` revealed:
     ```json
     {
       "id": "cmuq8llpi001dpcuhly2qif4f",
       "channel": "Instagram",
       "environment": "farfalina",
       "status": "CONNECTED",
       "instagramAccessToken": "IGAAQEc31zGv...",
       "instagramAccountId": "29643476368611224"
     }
     ```
   - Matches required account ID `"29643476368611224"`.

3. **Absence of `CRMClient` in Webhook Handler**:
   - File search across `app/api/webhooks/instagram/route.ts` shows **zero** occurrences of `cRMClient` or `CRMClient`.
   - In `app/api/webhooks/instagram/route.ts:235-372`, `processInstagramMessage` only interacts with `prisma.chatThread` and `prisma.chatMessage`.

4. **Defect in `ChatMessage.externalId` on Thread Creation**:
   - In `app/api/webhooks/instagram/route.ts:351-370`:
     ```typescript
     await prisma.chatThread.create({
       data: {
         clientName,
         phone: senderId,
         channel: "Instagram",
         status: isEcho ? "Pendientes" : "Por Responder",
         lastMessage: displayMessage,
         profilePicUrl,
         environment,
         messages: {
           create: {
             sender: senderRole,
             text: displayMessage,
             mediaUrl: mediaUrl || null,
             mediaType: mediaType || null,
             environment,
             // externalId is NOT included!
           },
         },
       },
     });
     ```
   - Empirical query on `dev.db` for the real message received at `2026-10-06T06:05:44.046Z`:
     - `ChatThread` id: `cmuw9yxgt0080tguhv34jhqxi`, `phone: "1777116329989423"`, `clientName: "Cliente Instagram (9423)"`.
     - `ChatMessage` id: `cmuw9yxgy0081tguh92wm9me2`, `externalId: null`, `timestamp: null`.

5. **Current `CRMClient` Table State in `prisma/dev.db`**:
   - There are 7 clients in `CRMClient`. Senders `"12334"` and `"1777116329989423"` are **not** present in `CRMClient`.

6. **AGENTS.md & Typing Rules**:
   - `route.ts:94`: `let body: Record<string, unknown>;`
   - `route.ts:112`: `const val = body.value as { sender?: { id?: string }; recipient?: { id?: string }; message?: { text?: string } };`
   - `route.ts:205`: `const val = (change?.value || {}) as { ... }`
   - Missing explicit Zod schema for incoming Meta Graph API payload.
   - Bilateral contract `{ success: true, data: { received: true }, code: "SUCCESS" }` is respected on all JSON responses.

---

## 2. Logic Chain

1. **From Observation 1**: The verification challenge GET handler works according to Meta Graph API specifications. No changes are required for GET verification.
2. **From Observation 2 & 3**: In `dev.db`, `ChannelConfig` is connected to `"29643476368611224"`, and incoming payloads are mapped to `environment: "farfalina"`. However, because `processInstagramMessage` does not reference `prisma.cRMClient`, no incoming Instagram contact is ever registered into CRM, directly failing Requirement R2 ("creando o vinculando el cliente en CRMClient").
3. **From Observation 4**: In `route.ts:360-368`, the absence of `externalId: externalId || undefined` inside `messages.create` causes the first message of any new thread to be stored with `externalId: null`. This was proven by the database query where `cmuw9yxgy0081tguh92wm9me2` has `externalId: null`. Deduplication on webhooks retries will fail for first messages.
4. **From Observation 5**: `CRMClient` schema requires `phone String @unique`. For Instagram Direct, the contact identifier is the IGSID (`senderId`). Storing `phone: senderId` matches how `ChatThread.phone` stores `senderId` and prevents duplicates.
5. **From Observation 6**: While response shapes obey the bilateral JSON contract, payload parsing relies on TypeScript `as` assertions without Zod runtime validation, in violation of AGENTS.md rule 6 ("Zod como única fuente de tipos").

---

## 3. Caveats

- **Network Dependency of Profile API**: `fetchInstagramProfile` calls Meta Graph API (`graph.facebook.com` / `graph.instagram.com`). In Development Mode or if the sender is not an approved Instagram Tester, Meta returns an API error; the system gracefully falls back to `Cliente Instagram (${senderId.slice(-4)})`.
- **Ephemeral Media**: `downloadAndCacheMetaMedia` downloads ephemeral CDN URLs to disk. If Meta CDN fails or expires before download, it falls back to ephemeral URL.
- **Multiple Attachments**: Instagram payloads can contain multiple items in `attachments[]`, but currently only `attachments[0]` is extracted.

---

## 4. Conclusion

The Instagram webhook handler is partially functional (GET handshake works, ChannelConfig is resolved, ChatThread and ChatMessage are inserted), but suffers from two critical defects and one compliance gap:
1. **Critical Defect 1**: No `CRMClient` creation or linking logic exists.
2. **Critical Defect 2**: `ChatMessage.externalId` is lost (`null`) when a new `ChatThread` is created.
3. **Compliance Gap**: Absence of Zod schema for inbound Meta webhook payload.

Resolving these requires:
1. Adding Zod payload schema validation.
2. Creating/linking `CRMClient` using `senderId` as the unique `phone` identifier with profile metadata and notes.
3. Passing `externalId: externalId || undefined` and `timestamp` into `messages.create` on new thread creation.
4. Incrementing `unreadCount` and updating `lastMessageAt` on `ChatThread`.

---

## 5. Verification Method

To independently verify findings and subsequent implementation:

1. **Run Meta Webhook Handshake Test**:
   ```bash
   npx tsx scripts/verify-meta-webhooks.ts --in-process
   ```
   *Expected outcome:* All 27 tests pass (9 for Instagram).

2. **Simulate Inbound Instagram Direct POST Payload**:
   ```bash
   npx tsx -e "fetch('http://localhost:3000/api/webhooks/instagram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ object: 'instagram', entry: [{ id: '29643476368611224', time: 1728198765432, messaging: [{ sender: { id: '998877665544' }, recipient: { id: '29643476368611224' }, timestamp: 1728198765432, message: { mid: 'mid_test_verify_9988', text: 'Test Instagram R2 Verification' } }] }] }) }).then(r => r.json()).then(console.log)"
   ```
   *Expected outcome:* HTTP 200 `{ success: true, data: { received: true }, code: "SUCCESS" }`.

3. **Verify Database Persistence in SQLite**:
   ```bash
   npx tsx -e "import { prisma } from './lib/db'; async function test() { const msg = await prisma.chatMessage.findFirst({ where: { externalId: 'mid_test_verify_9988' } }); console.log('Message:', msg); const client = await prisma.cRMClient.findUnique({ where: { phone: '998877665544' } }); console.log('CRMClient:', client); } test();"
   ```
   *Invalidation condition:* If `msg` is null, or `msg.externalId` is null, or `client` is null, verification fails.
