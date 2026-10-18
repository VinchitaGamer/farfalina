## 2026-10-06T02:45:36Z
You are a Specification Miner (teamwork_preview_spec_miner).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\spec_miner_webhooks\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md

Your mission:
Investigate specifications and testing requirements for Meta Developers Webhooks (R4):
1. Meta Webhook GET Handshake Specification:
   - Exact query parameters sent by Meta: `hub.mode`, `hub.challenge`, `hub.verify_token`.
   - Verification logic: mode must be 'subscribe'; verify_token must match configured token (from env var e.g. `META_VERIFY_TOKEN` / `WHATSAPP_VERIFY_TOKEN` or a default fallback if not configured).
   - Expected HTTP response: Status HTTP 200, response body MUST be the plain challenge string (not JSON wrapped, exactly the string received in hub.challenge).
   - Negative / failure responses: What status should be returned if mode != 'subscribe' or token does not match? (HTTP 403 Forbidden).
   - Edge cases: missing parameters, trailing slashes, encoding of challenge.
2. Automated Verification Script Design:
   - Requirements for an automated test script (e.g. node / ts-node / powershell / vitest / jest) that programmatically tests all 3 endpoints (`/api/webhooks/whatsapp`, `/api/webhooks/facebook`, `/api/webhooks/instagram`).
   - The test script must test:
     a) Successful verification with correct token -> returns 200 and exact challenge.
     b) Fallback / default token verification when env var is not set.
     c) Rejection with wrong token -> returns 403.
     d) Rejection with invalid hub.mode -> returns 403.
     e) Missing parameters -> returns 400 or 403.
   - How the script should be executed in Windows environments and CI/local development.

Write your detailed findings and test specification to c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\spec_miner_webhooks\handoff.md.
When complete, send a message to parent informing that your report is ready.
