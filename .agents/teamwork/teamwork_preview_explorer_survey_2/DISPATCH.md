# Task Assignment: Survey Instagram Webhook & SQLite Persistence

You are teamwork_preview_explorer_survey_2.
Working directory: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_survey_2
Original request: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md

Please survey R2 requirements:
1. Inspect `app/api/webhooks/instagram/route.ts` and related files/utilities.
2. Inspect `prisma/schema.prisma` and SQLite database `prisma/dev.db` (tables `ChannelConfig`, `CRMClient`, `ChatMessage`).
3. Check current handling of incoming Instagram Direct messages (`entry[].messaging[]` payload with sender.id, recipient.id, message.mid, text, attachments).
4. Identify gaps in mapping, linking/creating `CRMClient`, updating/inserting `ChatMessage`, and returning JSON `{ success: true, data: { received: true }, code: "SUCCESS" }`.
5. Review AGENTS.md rules (Zod schemas, Next.js App Router route handlers, no any, bilateral JSON contract).
6. Document findings, payload structures, database constraints, and recommended implementation plan in `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_survey_2\report.md` and `handoff.md`.
