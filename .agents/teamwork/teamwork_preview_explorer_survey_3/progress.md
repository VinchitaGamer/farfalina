# Progress - teamwork_preview_explorer_survey_3

Last visited: 2026-10-06T06:16:00Z

- [x] Initialized BRIEFING and progress tracking
- [x] Inspected `app/api/webhooks/instagram/route.ts` and related webhook verification utilities
- [x] Inspected `.env` and `.env.local` for `META_APP_SECRET`, `INSTAGRAM_*`, webhook verify tokens
- [x] Inspected SQLite `prisma/dev.db` for `ChannelConfig` entries (especially Instagram account `29643476368611224`)
- [x] Tested live validity of `instagramAccessToken` against Meta Graph API v22.0 (confirmed active for `@sour_jhxn`)
- [x] Analyzed HMAC-SHA256 signature verification behavior on test vs real payloads across 6 operational scenarios
- [x] Probed live GET handshake and POST message persistence on localhost:3000 and Cloudflare Tunnel `omnichannel.farfalina.tech`
- [x] Documented Meta Developers configuration rules (Dev vs Live mode, Instagram Tester invitation and acceptance workflow, Instagram App "Permitir acceso a los mensajes" directive)
- [x] Identified ancillary defects (Meta Graph API code 100 on `profile_pic` in `lib/instagram-profile.ts`, missing `CRMClient` syncing)
- [x] Compiled comprehensive `report.md` and 5-component `handoff.md`
- [x] Sent completion message to parent orchestrator
