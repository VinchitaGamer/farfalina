# Dispatch — Explorer Survey 3: Orders/Kanban, CRM, Omnichannel/Chat & Cash Register

You are an Explorer subagent for the Project Survey Phase.
Your Working Directory: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_3`

## MANDATORY INPUTS
- Read verbatim: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\AGENTS.md`
- Skills: `c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\ui-designer\SKILL.md`

## CRITICAL CONSTRAINTS
- R4: PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO. Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev`. Solo usar comandos de sólo lectura o independientes como `npx tsc --noEmit`.
- READ-ONLY: As an explorer, DO NOT modify source files. Explore, analyze, and write your report to `report.md` and `handoff.md` in your working directory.

## EXPLORATION SCOPE & ASSIGNMENT
Investigate:
1. Orders / Logistics / Kanban (`app/pedidos`, `app/logistics`, `OrderDelivery` components):
   - Check desktop vs tablet vs mobile (<768px).
   - How does the 3-state delivery Kanban behave on mobile? Can columns be viewed cleanly (e.g. tabs or scroll-snap carousel or responsive stacked cards)?
   - Are order tables converted into ergonomic touch cards on mobile (<768px)?
   - Delivery calendar and card printing actions: touch targets >= 44x44px.
2. CRM & Clients (`app/crm`, `CRMClient` components):
   - Client list and detail sheets/pages.
   - Are dense client tables converted into touch-friendly cards on mobile (<768px) with quick action buttons (WhatsApp, call, edit)?
   - Are forms using input font sizes >= 16px to prevent zoom?
3. Omnichannel / Chat Drawer & Posts/Comments (`app/chat`, omnichannel drawer components):
   - Chat list, message conversation thread, input bar, audio/image attachments.
   - Mobile screen fitting: Does the chat header, conversation history, and bottom input bar fit using `dvh`/`svh`?
   - Does opening the mobile virtual keyboard push the input bar cleanly (`interactiveWidget: 'resizes-content'`) without hiding active messages?
   - Safe-area-inset-bottom padding on the chat composer and send button.
   - Posts and comments tab / drawer responsiveness.
4. Cash Register / Arqueo / Accounting (`app/caja`, `app/contabilidad`, `CashRegisterShift`):
   - Shift opening/closing dialogs, cash movement logs, tables.
   - Are movement tables responsive (table on tablet/desktop, stacked cards on mobile)?
   - Touch targets and keypad/numeric inputs ergonomic and >= 44x44px.
5. Document specific files, line numbers, current deficiencies, and exact recommendations for fixes.

Deliver `report.md` and `handoff.md` in your working directory, then notify via `send_message`.
