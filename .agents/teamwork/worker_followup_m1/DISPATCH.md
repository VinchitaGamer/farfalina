## 2026-10-06T08:42:54Z
You are Worker subagent for Milestone M1 (Envío de Archivos Multimedia Salientes para Instagram Direct & WhatsApp).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m1

MANDATORY: You MUST read the original request at:
c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md (under ## Follow-up — 2026-10-06T08:21:10Z).
Also read:
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r1\analysis.md
- c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Boundaries:
You own exclusively:
- `lib/meta-graph-api.ts`
- `app/actions/omnichannel.ts` (specifically outbound message actions & media handling)
- `lib/evolution-api.ts` / `lib/meta-whatsapp.ts` (ensuring public URL format for media)
- `scripts/verify-outbound-media.ts` (automated verification script)

Detailed Objectives:
1. Fix Instagram Direct Outbound Media Dispatch in `lib/meta-graph-api.ts`:
   - Must use endpoint `https://graph.instagram.com/v22.0/me/messages` (NOT `graph.facebook.com`, which rejects IGAA tokens with OAuth 190).
   - Use token from `ChannelConfig` (`IGAA...`).
   - Format payload with `recipient: { id: recipientId }` and `message: { attachment: { type: 'image'|'audio'|'video'|'file', payload: { url: publicUrl } } }`.
   - Map MIME types correctly: `image/*` -> `image`, `audio/*` -> `audio`, `video/*` -> `video`, `application/pdf` / other docs -> `file`.
2. Update `sendChatMessageAction` in `app/actions/omnichannel.ts`:
   - When a media file is provided, persist it to disk at `public/uploads/{channel}/out_${timestamp}_${filename}`.
   - Construct absolute public URL via `https://omnichannel.farfalina.tech/uploads/{channel}/out_${timestamp}_${filename}`.
   - For Instagram: dispatch via `sendInstagramDirectMediaMessage` using the public URL.
   - For WhatsApp: pass the public URL to WhatsApp client.
   - Persist in `ChatMessage` with `mediaUrl`, `mediaType`, `text`, `sender: "AGENT"`.
   - Maintain `{ success, data, error, code }` response contract.
3. Verification:
   - Create and run `scripts/verify-outbound-media.ts` with ts-node or node.
   - Verify upload saving, public URL generation, payload formatting, DB record in `ChatMessage`, and Graph API call structure.
4. Output:
   - Document all changes in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m1\changes.md`.
   - Document verification results in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_followup_m1\handoff.md`.
   - Send completion message to orchestrator with summary of changes and verification results.
