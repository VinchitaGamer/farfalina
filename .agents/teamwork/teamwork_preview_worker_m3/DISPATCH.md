# Dispatch — Worker Milestone 3: Logistics Kanban, CRM & Agenda

You are the Worker for Milestone 3: Logistics Kanban, CRM & Agenda.
Your Working Directory: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m3`

## MANDATORY INPUTS
- Read verbatim: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md`
- Read Survey 3 Report: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_3\report.md`
- Read Survey 3 Handoff: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_3\handoff.md`
- Skills: `c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## CRITICAL CONSTRAINT R4: PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO
Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev` corriendo en la terminal de VS Code del cliente. Toda validación de compilación debe ejecutarse mediante comandos independientes como `npx tsc --noEmit`.

## EXCLUSIVE FILE OWNERSHIP
You own and may edit ONLY:
- `components/floreria/orders-view.tsx`
- `components/carissma/orders/orders-kanban-board.tsx`
- `components/carissma/orders/orders-agenda-table.tsx`
- `components/floreria/crm-view.tsx`
- `components/carissma/crm-view.tsx`
- `components/floreria/edit-order-modal.tsx`

## OBJECTIVES & DETAILED IMPLEMENTATION
1. **Florería Delivery Kanban (`components/floreria/orders-view.tsx`)**:
   - In mobile view (`< 768px`), add a segmented control / tab switcher (`[Pendientes ({count})]`, `[En Preparación ({count})]`, `[En Camino ({count})]`) with horizontal pill navigation, so delivery drivers and dispatchers can view each stage clearly.
   - Enforce touch targets `>= 44x44px`: `Tarjeta` (card print), `Editar`, and `Marcar "En camino"` / advance stage buttons must have `min-h-[44px] px-3 py-2 flex items-center justify-center`.
2. **Carissma Rental Kanban (`components/carissma/orders/orders-kanban-board.tsx`)**:
   - In mobile view (`< 768px`), add a segmented control / tab switcher across the 6 lifecycle stages (`Reservado`, `Preparación`, `Retirado`, `Uso`, `Devuelto`, `Inspección`) with smooth scrolling pills.
   - Stage progression buttons: enlarge from `py-1 text-[10px]` to `min-h-[44px] px-3 py-2 text-xs font-bold active:scale-95 touch-manipulation`.
   - Contract print button: enlarge hit area to `min-h-[44px] min-w-[44px] p-2.5`.
3. **Carissma Agenda Table (`components/carissma/orders/orders-agenda-table.tsx`)**:
   - Add dual rendering: `hidden md:block` for the 8-column table, `block md:hidden space-y-3` for stacked touch cards. Each card displays client, dress, return date, status badge, and action triggers with touch targets `>= 44x44px`.
4. **CRM Client Views (`components/floreria/crm-view.tsx` & `components/carissma/crm-view.tsx`)**:
   - Client lists: Add dual rendering: `hidden md:block` for table, `block md:hidden space-y-3` for stacked client touch cards (avatar, name, phone, tags, orders count, total spent, and quick-action buttons for WhatsApp/Call/Edit with touch targets `>= 44x44px`).
   - Search inputs: `text-base sm:text-xs md:text-sm` (16px on mobile).
5. **Florería Edit Order Modal (`components/floreria/edit-order-modal.tsx`)**:
   - Inputs and textareas styled with `text-base sm:text-xs`.
   - Touch targets on buttons and date/time pickers `>= 44x44px`.

## VERIFICATION
- Run `npx tsc --noEmit` and confirm 0 errors.
- Confirm development server at `http://localhost:3000` remains active (HTTP 200).
- Write `handoff.md` in your working directory and notify via `send_message`.


## 2026-10-09T20:24:34Z
You are the Worker for Milestone 3: Logistics Kanban, CRM & Agenda.
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m3
Read: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m3\DISPATCH.md
MANDATORY: Read c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md and c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md.
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
CRITICAL CONSTRAINT R4: Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso next dev o npm run dev en la terminal de VS Code. Validar únicamente con comandos independientes como npx tsc --noEmit.
Implement the mobile Kanban tab switchers, touch targets >= 44x44px on stage buttons and print icons, and dual table-to-card rendering in orders-agenda-table and CRM views.
Verify with npx tsc --noEmit, write handoff.md, and send completion message back.
