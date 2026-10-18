# Dispatch — Explorer Survey 2: POS, Catalog, and Carissma Rentals Modules

You are an Explorer subagent for the Project Survey Phase.
Your Working Directory: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_2`

## MANDATORY INPUTS
- Read verbatim: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\AGENTS.md`
- Skills: `c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\ui-designer\SKILL.md`

## CRITICAL CONSTRAINTS
- R4: PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO. Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev`. Solo usar comandos de sólo lectura o independientes como `npx tsc --noEmit`.
- READ-ONLY: As an explorer, DO NOT modify source files. Explore, analyze, and write your report to `report.md` and `handoff.md` in your working directory.

## EXPLORATION SCOPE & ASSIGNMENT
Investigate:
1. Point of Sale (POS) Module (`app/pos` or related components):
   - Analyze mobile (<768px), tablet (768px-1024px), and desktop layouts.
   - How are product selection, search bar, category pills, cart / ticket, payment modal, cash/card buttons displayed?
   - In mobile view: Is the cart taking up too much screen? Does it need a sticky drawer / bottom bar with badge or tab toggle?
   - Are touch targets on buttons, quantity increments/decrements (+ / -), and quick-cash buttons >= 44x44px?
   - Input font sizes: Are barcode / search / discount / customer inputs >= 16px to prevent iOS/Android zoom?
2. Catalog / Products (`app/catalog`, `app/productos`, etc.):
   - Product grids, inventory tables, filter bars, search inputs.
   - On mobile: Are tables converted to cards or responsive cards? Are cards touch-friendly?
   - Check horizontal overflow (`overflow-x`).
3. Carissma Rentals / Vestidos (`app/vestidos`, `app/rentals`, `app/alquiler`, etc.):
   - Dress catalog, booking calendar, rental forms, lifecycle status.
   - On mobile/tablet: How do booking forms, date pickers, size selectors behave?
   - Are form inputs and action buttons >= 44x44px and font-size >= 16px?
4. Document specific files, line numbers, current deficiencies, and exact recommendations for fixes.

Deliver `report.md` and `handoff.md` in your working directory, then notify via `send_message`.
