## 2026-10-06T02:59:54Z
You are a Webhook Verification & QA Worker (teamwork_preview_worker).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_m4\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the technical specifications from spec_miner_webhooks at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\spec_miner_webhooks\handoff.md
And the project scope at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\orchestrator_1\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & File Ownership:
You EXCLUSIVELY own:
1. `scripts/verify-meta-webhooks.ts`
2. `VERIFICAR_WEBHOOKS.bat`
3. `package.json` (only adding `"test:webhooks": "tsx scripts/verify-meta-webhooks.ts"` to scripts)
Do NOT modify any other files.

Your Mission (Milestone M4 - R4):
Implement programmatic verification for Meta Developers Webhooks:
1. Create `scripts/verify-meta-webhooks.ts`:
   - Must test all three endpoints:
     - `/api/webhooks/whatsapp`
     - `/api/webhooks/facebook`
     - `/api/webhooks/instagram`
   - Support dual-mode execution:
     a) Direct In-Process route handler execution: imports the route handlers (`GET`) and constructs standard `Request` objects. This allows running offline without needing a running server!
     b) Live HTTP mode: if `--live` flag is passed or if `http://localhost:3000` is reachable, performs real HTTP GET requests with `fetch`.
   - Comprehensive test assertions for each endpoint:
     - Test 1: Successful verification using default token (`farfalina_carissma_webhook_verify_token_2026`) with `hub.mode=subscribe` and challenge -> asserts HTTP 200, Content-Type text/plain, and exact challenge string in body.
     - Test 2: Successful verification using environment variable `META_VERIFY_TOKEN` (when configured) -> asserts HTTP 200 and exact challenge.
     - Test 3: Rejection with invalid/wrong token -> asserts HTTP 403 Forbidden.
     - Test 4: Rejection with invalid `hub.mode` (e.g. `unsubscribe` or random) -> asserts HTTP 400 or 403.
     - Test 5: Rejection when `hub.mode` or `hub.verify_token` is missing -> asserts HTTP 400 or 403.
     - Test 6: Challenge with special characters (spaces, hyphens, alphanumeric) echoed verbatim.
   - Clean, colored console output reporting pass/fail for every assertion. Exits with process code 0 on all passed, or code 1 on any failure.
2. Create `VERIFICAR_WEBHOOKS.bat`:
   - One-click Windows batch script in root that runs `npx tsx scripts/verify-meta-webhooks.ts` and pauses to display results.
3. Update `package.json`:
   - Add `"test:webhooks": "tsx scripts/verify-meta-webhooks.ts"` under `"scripts"`.
4. Verification & Testing:
   - Run `npx tsx scripts/verify-meta-webhooks.ts` and verify all tests pass 100%.
   - Run `npx tsc --noEmit` and verify TypeScript compilation is 100% clean with 0 errors.

Document all commands executed, exact console outputs, and results in your handoff report.
Write your completion report to `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_m4\handoff.md` and send a message to parent when done.
