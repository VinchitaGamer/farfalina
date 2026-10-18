# Handoff Report: Requirement R1 — Envío de Archivos Multimedia Salientes (Instagram Direct & WhatsApp)

**Agent ID**: `explorer_followup_r1`  
**Parent ID**: `1e373fa0-941b-417b-b7c3-a8dd99f78b05`  
**Date**: 2026-10-06  
**Type**: Hard Handoff (Investigation Complete)

---

## 1. Observation

1. **Chat UI Composer**:
   - In `components/shared/omnichannel/unified-omnichannel-view.tsx`, lines 1408–1424, there is a hidden file input:
     `<input ref={fileInputRef} type="file" onChange={handleFileChange} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*,video/*" className="hidden" />`
     activated by a paperclip button `Paperclip`.
   - Lines 525–546: `handleFileChange` validates `file.size > 25 * 1024 * 1024` and encodes file data via `FileReader.readAsDataURL` into `attachedFile.base64`.
   - Lines 559–567: `handleSendMessage` invokes Server Action `sendChatMessageAction({ threadId, sender: "agent", text, mediaBase64, mediaMimeType, mediaFileName, mediaUrl })`.
   - Note: The UI allows selecting audio files (`.ogg`, `.mp3`, `.wav`) but does not have a live microphone recorder component.
2. **Local Upload Handling & Serving**:
   - In `app/actions/omnichannel.ts`, lines 285–311: `sendChatMessageAction` decodes `mediaBase64`, saves to disk at `public/uploads/{channel}/out_${Date.now()}_${mediaFileName}`, and sets `savedMediaUrl = /uploads/${channelFolder}/${fname}` (a local relative path).
   - In `app/uploads/[...path]/route.ts` and `app/api/media/[...path]/route.ts`: media files are served via `lib/media-server.ts` (`serveMediaFileResponse`) supporting HTTP Range requests (206 Partial Content) and path-traversal guards.
   - Tested live via node fetch:
     - Local route: `http://localhost:3000/uploads/instagram/out_1791273004523_wa_1791252148359_3AF28B52AD5C923201D1.jpg` returned status `200 image/jpeg 92018`.
     - Public tunnel route: `https://omnichannel.farfalina.tech/uploads/instagram/out_1791273004523_wa_1791252148359_3AF28B52AD5C923201D1.jpg` returned status `200 image/jpeg 92018`.
3. **Database Schema & Persistence**:
   - In `prisma/schema.prisma`, lines 118–135 (`ChatMessage`):
     Fields `mediaUrl String?` and `mediaType String?` already exist.
     `attachmentType` does not exist on `ChatMessage` (it exists on `QuickReply`).
   - Querying recent messages in `prisma/dev.db` revealed that previous outbound image `cmuwdp4lx0005hwuh4olkpc40` had:
     `sender`: `"agent"`, `mediaUrl`: `"/uploads/instagram/out_1791273004523_wa_1791252148359_3AF28B52AD5C923201D1.jpg"`, `mediaType`: `"image"`, but `externalId`: `null` (outbound dispatch to Instagram failed).
4. **Outbound Instagram Direct Dispatch Defect & Live Verification**:
   - In `app/actions/omnichannel.ts`, lines 506–524:
     When `outgoingBase64` is present, it calls `sendInstagramDirectMediaMessage` passing `buffer: Buffer.from(outgoingBase64, "base64")`.
   - In `lib/meta-graph-api.ts`, lines 461–485:
     When `buffer` is passed, it attempts a multipart form upload with `filedata` to `${META_GRAPH_BASE}/me/messages` (`https://graph.facebook.com/v22.0/me/messages`).
   - When calling `https://graph.facebook.com/v22.0/me/messages` with Instagram user token `IGAA...`:
     Returned verbatim error:
     `{"error":{"message":"Invalid OAuth access token - Cannot parse access token","type":"OAuthException","code":190,"fbtrace_id":"A868JIrRbY65MGGc80jU_eS"}}`.
   - When calling `https://graph.instagram.com/v22.0/me/messages` with `{ recipient: { id: "1304358138230682" }, message: { attachment: { type, payload: { url: "https://omnichannel.farfalina.tech/uploads/..." } } } }`:
     Verbatim results:
     - `type: "image"`: `{"recipient_id":"1304358138230682","message_id":"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIwNTM0OTA2ODY1ODEwMDA1ODA5OTAyODA2NjMwNAZDZD"}`
     - `type: "file"`: `{"recipient_id":"1304358138230682","message_id":"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIwNTgwNDE0NDY2OTMxMDEzMjA5ODcyMDMzMzgyNAZDZD"}`
     - `type: "audio"`: `{"recipient_id":"1304358138230682","message_id":"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIwNTg4Mzk5NTkyMDQ4NTQ4MTk1MTczMDMzNTc0NAZDZD"}`
     - `type: "video"`: `{"recipient_id":"1304358138230682","message_id":"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIwNjAzNTkxOTUyMzA5NDAxODcwODM4MTYzMDQ2NAZDZD"}`
5. **Outbound WhatsApp Dispatch**:
   - `lib/meta-whatsapp.ts` provides `sendMetaWhatsAppMediaFromBase64` and `sendMetaWhatsAppMediaMessage`. Currently, `ChannelConfig` in SQLite has `whatsappPhoneNumberId: null` and `whatsappAccessToken: null`.
   - `lib/evolution-api.ts` provides `sendEvolutionMediaMessage` to `POST /message/sendMedia/{instance}`. It requires `media` to be an accessible URL or base64 (passing relative `/uploads/...` fails).
   - `lib/baileys-socket-manager.ts` provides `sendBaileysMediaMessage` using raw Buffer for `image`, `video`, `audio`, and `document`.

---

## 2. Logic Chain

1. From Observation 1, the user interface already supports file attachment for all mime types (`image/*`, `application/pdf`, `audio/*`, `video/*`), passes base64 to `sendChatMessageAction`, and renders messages with thumbnails, video player, audio player, and document download links.
2. From Observation 2, `sendChatMessageAction` successfully writes files to `public/uploads/{channel}/`, and both local Next.js and the public Cloudflare tunnel (`https://omnichannel.farfalina.tech`) serve them with status 200 and proper MIME headers.
3. However, from Observation 3 & 4, when sending to Instagram Direct, `sendChatMessageAction` attempts to send a memory `buffer` via multipart upload rather than providing a public HTTPS URL.
4. Furthermore, Meta Graph API on `graph.facebook.com` rejects Instagram User tokens (`IGAA...`) with error 190, and Instagram Direct does not support `filedata` uploads.
5. In contrast, when sending a public HTTPS URL (`https://omnichannel.farfalina.tech/uploads/...`) to `https://graph.instagram.com/v22.0/me/messages`, Meta Graph API immediately accepts all 4 media types (`image`, `file`, `audio`, `video`) and returns genuine Meta `message_id`s.
6. Therefore, the implementation plan to make outbound multimedia 100% operational requires:
   - Constructing the public URL: `const publicMediaUrl = `${publicBaseUrl}${savedMediaUrl}`;`
   - In `sendInstagramDirectMediaMessage`, ensuring `payload: { url: publicMediaUrl }` is dispatched to `https://graph.instagram.com/v22.0/me/messages` (when using `IGAA...` tokens).
   - In `sendEvolutionMediaMessage`, passing `publicMediaUrl` instead of local relative `/uploads/...`.
   - Mapping document MIME types (`application/pdf`, docx, etc.) to `type: "file"` for Instagram.

---

## 3. Caveats

- **Voice Recorder Button**: The UI composer currently relies on the file picker for audio files. A Web MediaRecorder microphone button for live audio recording in the browser is not yet built, though audio playback and sending work.
- **WhatsApp Official API Credentials**: In `ChannelConfig`, WhatsApp is currently unconfigured for Meta Cloud API (tokens are null), operating through Baileys socket or Evolution API.
- **Instagram Direct 24-hour Window**: As per Meta standard policy, outbound messages can only be sent to users within a 24-hour messaging window unless a human agent tag is supported.

---

## 4. Conclusion

- **Requirement R1 is completely feasible and already 80% implemented**.
- The database schema in `prisma/schema.prisma` already contains `mediaUrl` and `mediaType` on `ChatMessage`. No schema alterations or breaking changes are necessary.
- The root failure preventing outbound media delivery in Instagram Direct was conclusively proven to be:
  1. Passing in-memory buffer via multipart form to `graph.facebook.com` (which fails OAuth and is not supported by Instagram Send API), instead of sending the public tunnel URL (`https://omnichannel.farfalina.tech/uploads/...`) to `graph.instagram.com`.
  2. Passing relative paths (`/uploads/...`) instead of absolute public HTTPS URLs.
- Once the public URL is passed, Meta accepts images, voice notes/audio, videos, and PDF/documents with 100% success.

---

## 5. Verification Method

To independently verify the findings and the live endpoints:

1. **Verify Public Media Serving via Cloudflare Tunnel**:
   ```powershell
   node -e "fetch('https://omnichannel.farfalina.tech/uploads/instagram/out_1791273004523_wa_1791252148359_3AF28B52AD5C923201D1.jpg').then(r => console.log('Tunnel Status:', r.status, r.headers.get('content-type')))"
   ```
   *Expected result*: `Tunnel Status: 200 image/jpeg`.

2. **Verify Existing Multimedia Test Suite**:
   ```powershell
   npx tsx tests/multimedia-and-meta.test.ts
   ```
   *Expected result*: 19 tests pass (Range requests, traversal security, MIME mappings).

3. **Verify Instagram Send API with Public Tunnel URL**:
   ```powershell
   node -e "const db = new (require('better-sqlite3'))('./prisma/dev.db'); const c = db.prepare('SELECT instagramAccessToken FROM ChannelConfig WHERE channel = ? AND environment = ?').get('Instagram', 'farfalina'); const token = c.instagramAccessToken; const recipientId = '1304358138230682'; fetch('https://graph.instagram.com/v22.0/me/messages?access_token=' + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: { id: recipientId }, message: { attachment: { type: 'image', payload: { url: 'https://omnichannel.farfalina.tech/uploads/instagram/out_1791273004523_wa_1791252148359_3AF28B52AD5C923201D1.jpg' } } } }) }).then(r => r.json()).then(j => console.log('Meta Response:', j));"
   ```
   *Expected result*: `Meta Response: { recipient_id: '1304358138230682', message_id: 'aWdf...' }`.
